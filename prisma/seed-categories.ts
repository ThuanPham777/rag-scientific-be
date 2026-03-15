/**
 * Seed ArXiv CS Categories into KbCategory table.
 *
 * Usage: npx tsx prisma/seed-categories.ts
 */
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new (PrismaClient as any)({ adapter });

const ARXIV_CS_CATEGORIES = [
    { slug: 'cs.AI', name: 'Artificial Intelligence', description: 'Expert systems, theorem proving, knowledge representation, planning, uncertainty in AI' },
    { slug: 'cs.CL', name: 'Computation and Language', description: 'Natural language processing, text mining, speech recognition, machine translation' },
    { slug: 'cs.CV', name: 'Computer Vision', description: 'Image recognition, object detection, segmentation, pattern recognition' },
    { slug: 'cs.LG', name: 'Machine Learning', description: 'Supervised/unsupervised learning, deep learning, reinforcement learning, neural networks' },
    { slug: 'cs.NE', name: 'Neural and Evolutionary Computing', description: 'Neural networks, genetic algorithms, swarm intelligence' },
    { slug: 'cs.IR', name: 'Information Retrieval', description: 'Search engines, recommendation systems, text retrieval, RAG' },
    { slug: 'cs.DB', name: 'Databases', description: 'Database design, query optimization, data management, NoSQL' },
    { slug: 'cs.DS', name: 'Data Structures and Algorithms', description: 'Sorting, searching, graph algorithms, complexity analysis' },
    { slug: 'cs.CR', name: 'Cryptography and Security', description: 'Encryption, authentication, network security, privacy' },
    { slug: 'cs.DC', name: 'Distributed Computing', description: 'Parallel computing, distributed algorithms, cloud computing, fault tolerance' },
    { slug: 'cs.SE', name: 'Software Engineering', description: 'Software design, testing, maintenance, DevOps, agile methodologies' },
    { slug: 'cs.HC', name: 'Human-Computer Interaction', description: 'User interfaces, usability, accessibility, UX research' },
    { slug: 'cs.RO', name: 'Robotics', description: 'Robot control, autonomous systems, SLAM, manipulation' },
    { slug: 'cs.SI', name: 'Social and Information Networks', description: 'Social network analysis, graph mining, community detection' },
    { slug: 'cs.PL', name: 'Programming Languages', description: 'Language design, compilers, type theory, formal semantics' },
    { slug: 'cs.OS', name: 'Operating Systems', description: 'Process management, memory management, file systems, virtualization' },
    { slug: 'cs.NI', name: 'Networking and Internet Architecture', description: 'Network protocols, TCP/IP, routing, SDN, IoT' },
    { slug: 'cs.CG', name: 'Computational Geometry', description: 'Geometric algorithms, mesh generation, spatial data structures' },
    { slug: 'cs.GT', name: 'Computer Science and Game Theory', description: 'Mechanism design, auction theory, computational social choice' },
    { slug: 'cs.CC', name: 'Computational Complexity', description: 'Complexity classes, P vs NP, approximation algorithms' },
    { slug: 'cs.FL', name: 'Formal Languages and Automata Theory', description: 'Regular expressions, context-free grammars, Turing machines' },
    { slug: 'cs.LO', name: 'Logic in Computer Science', description: 'Formal verification, model checking, satisfiability' },
    { slug: 'cs.MA', name: 'Multiagent Systems', description: 'Agent coordination, multi-agent reinforcement learning, swarm robotics' },
    { slug: 'cs.CE', name: 'Computational Engineering', description: 'Simulation, finite elements, computational fluid dynamics' },
    { slug: 'cs.MM', name: 'Multimedia', description: 'Audio/video processing, streaming, content delivery, compression' },
];

async function main() {
    console.log('🌱 Seeding ArXiv CS categories...\n');

    let created = 0;
    let skipped = 0;

    for (const cat of ARXIV_CS_CATEGORIES) {
        const existing = await prisma.kbCategory.findFirst({
            where: { slug: cat.slug },
        });

        if (existing) {
            console.log(`  ⏭ ${cat.slug} — already exists`);
            skipped++;
            continue;
        }

        await prisma.kbCategory.create({
            data: {
                name: cat.name,
                slug: cat.slug,
                description: cat.description,
                parentId: null,
            },
        });
        console.log(`  ✅ ${cat.slug} — ${cat.name}`);
        created++;
    }

    console.log(`\n🎉 Done! Created: ${created}, Skipped: ${skipped}`);
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
