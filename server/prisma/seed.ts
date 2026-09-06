import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const items = [
  { articleNumber: '25001', productName: 'Round Cocoon Hanging Lamp', productSize: '55 x 55 x 49 cm', material: 'Iron 1.20 kg, Acrylic Sheet 300 g, Paper 4 sheet', netWeight: 2.6, priceUSD: 33 },
  { articleNumber: '25002', productName: 'Dome Cocoon Hanging Lamp', productSize: '50 x 50 x 33 cm', material: 'Iron 1.00 kg, Acrylic Sheet 300 g, Paper 4 sheet', netWeight: 2.0, priceUSD: 28 },
  { articleNumber: '25003', productName: 'Oval Cocoon Hanging Lamp', productSize: '40 x 40 x 62 cm', material: 'Iron 1.4 kg, Acrylic Sheet 600 g, Paper 5 sheet', netWeight: 2.8, priceUSD: 33 },
  { articleNumber: '25004', productName: 'Tall Cocoon Hanging Lamp', productSize: '35 x 35 x 70 cm', material: 'Iron 1.5 kg, Acrylic Sheet 700 g, Paper 6 sheet', netWeight: 3.0, priceUSD: 35 },
  { articleNumber: '25005', productName: 'Mini Cocoon Hanging Lamp', productSize: '30 x 30 x 30 cm', material: 'Iron 0.8 kg, Acrylic Sheet 200 g, Paper 3 sheet', netWeight: 1.5, priceUSD: 22 },
  { articleNumber: '25006', productName: 'Pumpkin Cocoon Hanging Lamp', productSize: '45 x 45 x 35 cm', material: 'Iron 1.1 kg, Acrylic Sheet 350 g, Paper 4 sheet', netWeight: 2.3, priceUSD: 30 },
  { articleNumber: '25007', productName: 'Drop Cocoon Hanging Lamp', productSize: '38 x 38 x 55 cm', material: 'Iron 1.2 kg, Acrylic Sheet 400 g, Paper 4 sheet', netWeight: 2.5, priceUSD: 32 },
  { articleNumber: '25008', productName: 'Kibo Hanging Lamp', productSize: '42 x 42 x 50 cm', material: 'Iron 1.3 kg, Acrylic Sheet 450 g, Paper 5 sheet', netWeight: 2.7, priceUSD: 29 },
  { articleNumber: '25009', productName: 'Globe Cocoon Hanging Lamp', productSize: '60 x 60 x 60 cm', material: 'Iron 1.8 kg, Acrylic Sheet 500 g, Paper 6 sheet', netWeight: 3.5, priceUSD: 40 },
  { articleNumber: '25010', productName: 'Cone Cocoon Hanging Lamp', productSize: '33 x 33 x 60 cm', material: 'Iron 1.0 kg, Acrylic Sheet 300 g, Paper 4 sheet', netWeight: 2.1, priceUSD: 27 }
];

async function main() {
  for (const it of items) {
    await prisma.item.upsert({
      where: { articleNumber: it.articleNumber },
      update: it,
      create: it
    });
  }
  console.log(`Seeded ${items.length} items`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
