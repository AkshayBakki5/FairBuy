import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: "30d",
  });

function makeTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Gmail App Password (16 chars)
    },
  });
}

// In-memory store for reset tokens  { token -> { userId, expires } }
const resetTokenStore = new Map();

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "Name, Email and password are required" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ name, email, password });
    if (!user) return res.status(400).json({ message: "Invalid user data" });

    // Send welcome email (non-blocking — don't fail signup if email fails)
    try {
      const t = makeTransporter();
      await t.sendMail({
        from: `"FairBuy 🛒" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Welcome to FairBuy!",
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:auto;">
            <h2 style="color:#4f46e5;">Welcome to FairBuy 🛒</h2>
            <p>Hi there! Your account has been created successfully.</p>
            <p>You can now search for products across Amazon, Flipkart, Blinkit, Zepto, BigBasket and more — all in one place.</p>
            <a href="${process.env.CLIENT_URL || "http://localhost:5173"}/login"
               style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:12px;">
              Start Shopping →
            </a>
            <p style="margin-top:24px;font-size:12px;color:#999;">If you didn't create this account, please ignore this email.</p>
          </div>`,
      });
    } catch (mailErr) {
      console.warn("⚠️  Welcome email failed:", mailErr.message);
    }

    res.status(201).json({
      _id: user._id,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/me", protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user) {
    res.json({ _id: user._id, email: user.email });
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post("/logout", (_req, res) => {
  res.json({ message: "Logged out successfully" });
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
// Sends a password-reset link to the user's Gmail
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    // Always return 200 to avoid leaking whether the email exists
    if (!user)
      return res.json({
        message: "If that email exists, a reset link has been sent.",
      });

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour
    resetTokenStore.set(token, { userId: user._id.toString(), expires });

    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/update-password?token=${token}`;

    const t = makeTransporter();
    await t.sendMail({
      from: `"FairBuy 🔒" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset your FairBuy password",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;">
          <h2 style="color:#4f46e5;">Reset Your Password</h2>
          <p>We received a request to reset the password for your FairBuy account.</p>
          <p>Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0;">
            Reset Password →
          </a>
          <p style="font-size:12px;color:#999;margin-top:24px;">
            If you didn't request a password reset, you can safely ignore this email.<br/>
            This link will expire at ${new Date(expires).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST.
          </p>
        </div>`,
    });

    console.log(`📧 Password reset link sent to ${email}`);
    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (error) {
    console.error("[forgot-password]", error.message);
    res.status(500).json({
      message:
        "Failed to send reset email. Check EMAIL_USER/EMAIL_PASS in .env",
    });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
// Called when user submits the new password from the reset link
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res
        .status(400)
        .json({ message: "Token and password are required" });
    if (password.length < 6)
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });

    const entry = resetTokenStore.get(token);
    if (!entry)
      return res.status(400).json({ message: "Invalid or expired reset link" });
    if (Date.now() > entry.expires) {
      resetTokenStore.delete(token);
      return res
        .status(400)
        .json({ message: "Reset link has expired. Please request a new one." });
    }

    const user = await User.findById(entry.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = password; // pre-save hook will hash it
    await user.save();
    resetTokenStore.delete(token);

    console.log(`🔑 Password reset for ${user.email}`);
    res.json({ message: "Password updated successfully. You can now log in." });
  } catch (error) {
    console.error("[reset-password]", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ── PATCH /api/auth/update-password ──────────────────────────────────────────
// For logged-in users updating their password
router.patch("/update-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res
        .status(400)
        .json({ message: "Current and new password are required" });
    if (newPassword.length < 6)
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters" });

    const user = await User.findById(req.user._id).select('+password');
    const match = await user.matchPassword(currentPassword);
    if (!match)
      return res.status(401).json({ message: "Current password is incorrect" });

    user.password = newPassword;
    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
