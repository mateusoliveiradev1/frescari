import { config } from 'dotenv';

// Load directly from the root project dir
config({ path: '../../.env' });
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

const masterProductsData = [
    { name: "Tomate Carmem", category: "Hortaliças", defaultImageUrl: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&q=80" },
    { name: "Banana Prata", category: "Frutas", defaultImageUrl: "https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=800&q=80" },
    { name: "Cebola", category: "Hortaliças", defaultImageUrl: "https://images.unsplash.com/photo-1466814314367-45caeebcbddc?w=800&q=80" },
    { name: "Alface Crespa", category: "Folhas", defaultImageUrl: "https://images.unsplash.com/photo-1622206151226-189f7f45c26b?w=800&q=80" },
    { name: "Cenoura", category: "Hortaliças", defaultImageUrl: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800&q=80" },
    { name: "Manga Palmer", category: "Frutas", defaultImageUrl: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&q=80" },
    { name: "Batata Lisa", category: "Hortaliças", defaultImageUrl: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&q=80" },
    { name: "Brócolis", category: "Hortaliças", defaultImageUrl: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=800&q=80" },
    { name: "Maçã Tommy", category: "Frutas", defaultImageUrl: "https://images.unsplash.com/photo-1560806887-1e4cd0b6ffa6?w=800&q=80" },
    { name: "Limão Tahiti", category: "Frutas", defaultImageUrl: "https://images.unsplash.com/photo-1590502593747-4229879f7625?w=800&q=80" },
];

async function seedMasterProducts() {
    console.log("Seeding master products...");
    for (const product of masterProductsData) {

        const id = crypto.randomUUID();

        await sql`
            INSERT INTO "master_products" ("id", "name", "category", "default_image_url")
            VALUES (${id}, ${product.name}, ${product.category}, ${product.defaultImageUrl})
            ON CONFLICT ("id") DO NOTHING;
        `;
    }
    console.log("Master products seeded.");
}

seedMasterProducts().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
