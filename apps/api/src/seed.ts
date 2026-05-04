import './config/env'
import { prisma } from './config/prisma'
import { hashPassword } from './services/auth.service'
import { UserRole } from '@prisma/client'

async function seed() {
  console.log('🌱 Seeding database...')

  // Create super admin
  const existing = await prisma.user.findUnique({ where: { email: 'admin@contadordocampo.com.br' } })
  if (!existing) {
    const passwordHash = await hashPassword('admin123456')
    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: 'admin@contadordocampo.com.br',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
      },
    })
    console.log('✅ Super admin created: admin@contadordocampo.com.br / admin123456')
  } else {
    console.log('ℹ️  Super admin already exists')
  }

  // Create default plans
  const plans = [
    {
      name: 'Básico',
      type: 'BASIC' as any,
      priceMonthly: 97,
      maxProperties: 1,
      maxUsers: 1,
      hasOcr: false,
      hasAiAgent: false,
      hasAutoDre: false,
      hasAlerts: false,
      hasWhitelabel: false,
      hasPrioritySupport: false,
    },
    {
      name: 'Pro',
      type: 'PRO' as any,
      priceMonthly: 197,
      maxProperties: 3,
      maxUsers: 1,
      hasOcr: true,
      hasAiAgent: true,
      hasAutoDre: true,
      hasAlerts: true,
      hasWhitelabel: false,
      hasPrioritySupport: false,
    },
    {
      name: 'Cooperativa',
      type: 'COOPERATIVE' as any,
      priceMonthly: 2000,
      maxProperties: 999,
      maxUsers: 500,
      hasOcr: true,
      hasAiAgent: true,
      hasAutoDre: true,
      hasAlerts: true,
      hasWhitelabel: true,
      hasPrioritySupport: true,
    },
  ]

  for (const plan of plans) {
    const existing = await prisma.plan.findFirst({ where: { name: plan.name } })
    if (!existing) {
      await prisma.plan.create({ data: plan })
      console.log(`✅ Plan created: ${plan.name} — R$${plan.priceMonthly}/mês`)
    } else {
      console.log(`ℹ️  Plan already exists: ${plan.name}`)
    }
  }

  console.log('\n🎉 Seed complete!')
  console.log('\n📋 Next steps:')
  console.log('1. Configure your .env with database credentials')
  console.log('2. Run: npx prisma migrate dev')
  console.log('3. Run: npx tsx src/seed.ts')
  console.log('4. Access admin panel: http://localhost:3000/admin')
  console.log('   Login: admin@contadordocampo.com.br / admin123456')
  console.log('5. Configure Stripe, Evolution API, and AI keys in Admin > Configurações')
  console.log('6. Configure Evolution webhook: POST {YOUR_API_URL}/api/webhook/whatsapp')
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
