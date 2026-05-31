-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_type_idx" ON "ActivityLog"("type");

-- CreateIndex
CREATE INDEX "ActivityLog_category_idx" ON "ActivityLog"("category");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_type_idx" ON "ActivityLog"("createdAt", "type");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Ad_isActive_idx" ON "Ad"("isActive");

-- CreateIndex
CREATE INDEX "Block_playerId_idx" ON "Block"("playerId");

-- CreateIndex
CREATE INDEX "Block_ownerId_idx" ON "Block"("ownerId");

-- CreateIndex
CREATE INDEX "Block_futsalId_idx" ON "Block"("futsalId");

-- CreateIndex
CREATE INDEX "Block_createdAt_idx" ON "Block"("createdAt");

-- CreateIndex
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");

-- CreateIndex
CREATE INDEX "Booking_bookingDate_idx" ON "Booking"("bookingDate");

-- CreateIndex
CREATE INDEX "Booking_userId_status_idx" ON "Booking"("userId", "status");

-- CreateIndex
CREATE INDEX "Booking_status_bookingDate_idx" ON "Booking"("status", "bookingDate");

-- CreateIndex
CREATE INDEX "Booking_bookingDate_status_idx" ON "Booking"("bookingDate", "status");

-- CreateIndex
CREATE INDEX "Booking_paymentMethod_idx" ON "Booking"("paymentMethod");

-- CreateIndex
CREATE INDEX "Booking_status_paymentMethod_idx" ON "Booking"("status", "paymentMethod");

-- CreateIndex
CREATE INDEX "Court_futsalId_idx" ON "Court"("futsalId");

-- CreateIndex
CREATE INDEX "Court_isActive_idx" ON "Court"("isActive");

-- CreateIndex
CREATE INDEX "Court_futsalId_isActive_idx" ON "Court"("futsalId", "isActive");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE INDEX "Favorite_futsalId_idx" ON "Favorite"("futsalId");

-- CreateIndex
CREATE INDEX "Futsal_ownerId_idx" ON "Futsal"("ownerId");

-- CreateIndex
CREATE INDEX "Futsal_status_idx" ON "Futsal"("status");

-- CreateIndex
CREATE INDEX "Futsal_isApproved_idx" ON "Futsal"("isApproved");

-- CreateIndex
CREATE INDEX "Futsal_createdAt_idx" ON "Futsal"("createdAt");

-- CreateIndex
CREATE INDEX "Futsal_status_isApproved_idx" ON "Futsal"("status", "isApproved");

-- CreateIndex
CREATE INDEX "Futsal_ownerId_status_idx" ON "Futsal"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Match_tournamentId_idx" ON "Match"("tournamentId");

-- CreateIndex
CREATE INDEX "Match_matchDate_idx" ON "Match"("matchDate");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE INDEX "Match_tournamentId_status_idx" ON "Match"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "Match_homeTeamId_idx" ON "Match"("homeTeamId");

-- CreateIndex
CREATE INDEX "Match_awayTeamId_idx" ON "Match"("awayTeamId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_method_idx" ON "Payment"("status", "method");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt");

-- CreateIndex
CREATE INDEX "Review_futsalId_rating_idx" ON "Review"("futsalId", "rating");

-- CreateIndex
CREATE INDEX "Team_tournamentId_idx" ON "Team"("tournamentId");

-- CreateIndex
CREATE INDEX "Team_name_idx" ON "Team"("name");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_userId_idx" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "TimeSlot_courtId_idx" ON "TimeSlot"("courtId");

-- CreateIndex
CREATE INDEX "TimeSlot_date_idx" ON "TimeSlot"("date");

-- CreateIndex
CREATE INDEX "TimeSlot_status_idx" ON "TimeSlot"("status");

-- CreateIndex
CREATE INDEX "TimeSlot_courtId_date_idx" ON "TimeSlot"("courtId", "date");

-- CreateIndex
CREATE INDEX "TimeSlot_date_status_idx" ON "TimeSlot"("date", "status");

-- CreateIndex
CREATE INDEX "TimeSlot_status_lockedUntil_idx" ON "TimeSlot"("status", "lockedUntil");

-- CreateIndex
CREATE INDEX "Tournament_futsalId_idx" ON "Tournament"("futsalId");

-- CreateIndex
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");

-- CreateIndex
CREATE INDEX "Tournament_startDate_idx" ON "Tournament"("startDate");

-- CreateIndex
CREATE INDEX "Tournament_isPublished_idx" ON "Tournament"("isPublished");

-- CreateIndex
CREATE INDEX "Tournament_futsalId_status_idx" ON "Tournament"("futsalId", "status");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_isApproved_idx" ON "User"("isApproved");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_role_isApproved_idx" ON "User"("role", "isApproved");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
