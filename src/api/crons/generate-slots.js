import { prisma } from "../../index.js";

export default async function handler(req, res) {
  if (req.headers["user-agent"] !== "vercel-cron/1.0") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("🔄 Checking for courts needing slot generation...");

    const courts = await prisma.court.findMany({
      where: { isActive: true, isUnderMaintenance: false },
      include: { futsal: true },
    });

    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 30);

    let totalGenerated = 0;

    for (const court of courts) {
      const latestSlot = await prisma.timeSlot.findFirst({
        where: { courtId: court.id },
        orderBy: { date: "desc" },
      });

      const startDate = latestSlot
        ? new Date(latestSlot.date)
        : new Date(today);

      if (latestSlot) {
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(12, 0, 0, 0);
      }

      if (startDate >= targetDate) continue;

      const slots = [];
      for (
        let d = new Date(startDate);
        d < targetDate;
        d.setDate(d.getDate() + 1)
      ) {
        for (let hour = 6; hour < 17; hour++) {
          const slotTime = new Date(d);
          slotTime.setHours(hour, 0, 0, 0);

          slots.push({
            courtId: court.id,
            date: slotTime,
            startTime: hour.toString(),
            endTime: (hour + 1).toString(),
            price: court.basePrice,
            status: "AVAILABLE"
          });
        }
      }

      if (slots.length > 0) {
        const result = await prisma.timeSlot.createMany({
          data: slots,
          skipDuplicates: true,
        });
        totalGenerated += result.count;
        console.log(
          `✅ Generated ${result.count} slots for court ${court.courtNumber}`,
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Total slots generated: ${totalGenerated}`,
    });
  } catch (error) {
    console.error("❌ Error generating missing slots:", error);
    res.status(500).json({ error: error.message });
  }
}
