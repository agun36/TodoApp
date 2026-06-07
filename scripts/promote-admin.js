#!/usr/bin/env node
/**
 * Promote a user to workspace admin by email.
 * Usage: node scripts/promote-admin.js you@company.com
 */
require('dotenv').config();
const { prisma } = require('../shared/prisma.service.js');

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error('Usage: node scripts/promote-admin.js <email>');
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  });

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  if (user.role === 'admin') {
    console.log(`${user.email} is already a workspace admin.`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'admin' }
  });

  console.log(`Promoted ${user.email} to workspace admin. Sign out and sign back in to see admin tools.`);
}

main()
  .catch(function (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(function () {
    return prisma.$disconnect();
  });
