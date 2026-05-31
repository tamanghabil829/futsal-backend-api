import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seeActivities() {
  const activities = await prisma.activityLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' }
  })
  console.log(JSON.stringify(activities, null, 2))
  await prisma.$disconnect()
}

seeActivities()