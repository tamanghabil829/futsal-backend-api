import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";

import {
  getDashboardStats,
  getUsers,
  approveOwner,
  toggleUserStatus,         // ✅ new
  getPendingFutsals,
  getAllFutsals,            // ✅ new
  approveFutsal,
  rejectFutsal,
  generateReport,            // ✅ new
  getAllBookings,
  getAdminAnalytics,
   getAdminProfile,      // ✅ Add this
  updateAdminProfile,
  editUser,
  deleteUser,
  changeUserRole,
} from "../controllers/admin.controller.js";

const router = express.Router();

/* Dashboard */
router.get("/dashboard", authenticate, authorize("ADMIN"), getDashboardStats);

/* Users */
router.get("/users", authenticate, authorize("ADMIN"), getUsers);
router.patch("/users/:id/approve-owner", authenticate, authorize("ADMIN"), approveOwner);
router.patch("/users/:id/toggle-status", authenticate, authorize("ADMIN"), toggleUserStatus); // ✅ block/unblock

/* Futsal approvals */
router.get("/futsals/pending", authenticate, authorize("ADMIN"), getPendingFutsals);
router.get("/futsals", authenticate, authorize("ADMIN"), getAllFutsals); // ✅ all futsals tab
router.patch("/futsals/:id/approve", authenticate, authorize("ADMIN"), approveFutsal);
router.patch("/futsals/:id/reject", authenticate, authorize("ADMIN"), rejectFutsal);

/* Reports */
router.get("/reports", authenticate, authorize("ADMIN"), generateReport); // ✅ report endpoint

router.get("/bookings", authenticate, authorize("ADMIN"), getAllBookings);
router.get("/analytics", authenticate, authorize("ADMIN"), getAdminAnalytics);

/* Admin Profile */
router.get("/profile", authenticate, authorize("ADMIN"), getAdminProfile);
router.put("/profile", authenticate, authorize("ADMIN"), updateAdminProfile);

router.patch("/users/:id/edit", authenticate, authorize("ADMIN"), editUser);
router.delete("/users/:id", authenticate, authorize("ADMIN"), deleteUser);
router.patch("/users/:id/change-role", authenticate, authorize("ADMIN"), changeUserRole);



export default router;