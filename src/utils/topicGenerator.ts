import { prisma } from './prisma';

// Comprehensive topic categories with specific subjects
const TOPIC_CATEGORIES = {
    technology: [
        'artificial intelligence in everyday life',
        'robotics in healthcare',
        'space exploration missions',
        'renewable energy innovations',
        'cybersecurity challenges',
        'quantum computing basics',
        'virtual reality applications',
        'autonomous vehicles',
        '5G technology impact',
        'blockchain beyond cryptocurrency'
    ],
    culture: [
        'traditional festivals around the world',
        'indigenous art forms',
        'street food culture',
        'music genres evolution',
        'cultural architecture',
        'traditional crafts preservation',
        'global fashion trends',
        'cultural etiquette differences',
        'ancient storytelling traditions',
        'cultural celebrations and rituals'
    ],
    nature: [
        'coral reef ecosystems',
        'endangered species conservation',
        'volcanic formations',
        'Amazon rainforest biodiversity',
        'ocean currents and climate',
        'mountain ecosystems',
        'desert adaptations',
        'wildlife migration patterns',
        'natural phenomena and wonders',
        'forest conservation efforts'
    ],
    science: [
        'gene editing technologies',
        'psychology of habits',
        'particle physics discoveries',
        'neuroscience and memory',
        'vaccine development',
        'climate science basics',
        'DNA and genetics',
        'sleep science',
        'human evolution',
        'scientific method in action'
    ],
    society: [
        'sustainable urban planning',
        'modern education systems',
        'social media influence',
        'future of remote work',
        'community building initiatives',
        'public transportation evolution',
        'affordable housing solutions',
        'digital divide challenges',
        'volunteerism and service',
        'generational differences'
    ],
    history: [
        'ancient civilizations achievements',
        'invention of the printing press',
        'industrial revolution impact',
        'space race history',
        'historical trade routes',
        'ancient engineering marvels',
        'pivotal historical moments',
        'evolution of communication',
        'historical figures who changed the world',
        'archaeological discoveries'
    ],
    health: [
        'plant-based nutrition',
        'mental wellness practices',
        'fitness trends and science',
        'preventive healthcare',
        'meditation and mindfulness',
        'sleep hygiene importance',
        'stress management techniques',
        'nutrition myths debunked',
        'exercise for different ages',
        'holistic health approaches'
    ],
    arts: [
        'impressionism art movement',
        'theater through the ages',
        'digital art revolution',
        'modern architecture design',
        'poetry and spoken word',
        'film making techniques',
        'sculpture and 3D art',
        'photography as art',
        'street art and murals',
        'performance art evolution'
    ],
    adventure: [
        'hiking famous trails',
        'extreme sports psychology',
        'underwater exploration',
        'mountain climbing challenges',
        'solo travel experiences',
        'cultural immersion journeys',
        'adventure photography',
        'survival skills basics',
        'exploring remote locations',
        'adventure tourism impact'
    ],
    innovation: [
        'startup success stories',
        'design thinking principles',
        'sustainable innovations',
        'creative problem solving',
        'social entrepreneurship',
        'disruptive technologies',
        'innovation in education',
        'circular economy models',
        'biomimicry in design',
        'collaborative innovation'
    ]
};

// Writing style variations
const WRITING_STYLES = [
    'narrative',
    'expository',
    'descriptive',
    'persuasive',
    'analytical',
    'journalistic',
    'informative',
    'creative'
];

// Perspective variations
const PERSPECTIVES = [
    'a first-person account',
    'a third-person observation',
    'an expert analysis',
    'a historical perspective',
    'a future outlook',
    'a beginner\'s guide',
    'a comparative view',
    'a critical examination'
];

// Narrative hook variations — specific angles that ground the article
const CONTENT_HOOKS = [
    'focusing on a surprising recent discovery',
    'told through the story of one specific person or character',
    'comparing two contrasting real-world examples',
    'structured around a common misconception being corrected',
    'set in a specific country or cultural context',
    'framed as a problem and its creative solution',
    'examining the historical contrast with the present day',
    'built around a single striking statistic or fact',
    'written as if the reader is experiencing it firsthand',
    'exploring an unexpected or counterintuitive angle'
];

interface TopicSelection {
    category: string;
    topic: string;
    style: string;
    perspective: string;
    hook: string;
}

/**
 * Select a random topic avoiding recently used ones
 */
export async function selectRandomTopic(userId: string): Promise<TopicSelection> {
    try {
        // Fetch user's recent topics (last 20)
        const recentTopics = await prisma.recentTopic.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { category: true, topic: true }
        });

        // Extract recently used categories and topics
        const usedCategories = new Set(recentTopics.map(rt => rt.category));
        const usedTopics = new Set(recentTopics.map(rt => rt.topic));

        // Get available categories (prefer unused ones)
        const allCategories = Object.keys(TOPIC_CATEGORIES);
        let availableCategories = allCategories.filter(cat => !usedCategories.has(cat));

        // If all categories have been used recently, use all categories
        if (availableCategories.length === 0) {
            availableCategories = allCategories;
        }

        // Select random category
        const selectedCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];

        // Get topics from selected category
        const categoryTopics = TOPIC_CATEGORIES[selectedCategory as keyof typeof TOPIC_CATEGORIES];

        // Filter out recently used topics from this category
        let availableTopics = categoryTopics.filter(topic => !usedTopics.has(topic));

        // If all topics in this category were used, use all topics
        if (availableTopics.length === 0) {
            availableTopics = categoryTopics;
        }

        // Select random topic
        const selectedTopic = availableTopics[Math.floor(Math.random() * availableTopics.length)];

        // Select random writing style
        const selectedStyle = WRITING_STYLES[Math.floor(Math.random() * WRITING_STYLES.length)];

        // Select random perspective
        const selectedPerspective = PERSPECTIVES[Math.floor(Math.random() * PERSPECTIVES.length)];

        // Select random narrative hook
        const selectedHook = CONTENT_HOOKS[Math.floor(Math.random() * CONTENT_HOOKS.length)];

        return {
            category: selectedCategory,
            topic: selectedTopic,
            style: selectedStyle,
            perspective: selectedPerspective,
            hook: selectedHook
        };
    } catch (error) {
        console.error('Error selecting random topic:', error);
        // Fallback to completely random selection if database fails
        const categories = Object.keys(TOPIC_CATEGORIES);
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        const topics = TOPIC_CATEGORIES[randomCategory as keyof typeof TOPIC_CATEGORIES];

        return {
            category: randomCategory,
            topic: topics[Math.floor(Math.random() * topics.length)],
            style: WRITING_STYLES[Math.floor(Math.random() * WRITING_STYLES.length)],
            perspective: PERSPECTIVES[Math.floor(Math.random() * PERSPECTIVES.length)],
            hook: CONTENT_HOOKS[Math.floor(Math.random() * CONTENT_HOOKS.length)]
        };
    }
}

/**
 * Save generated topic to recent topics
 */
export async function saveRecentTopic(userId: string, category: string, topic: string): Promise<void> {
    try {
        await prisma.recentTopic.create({
            data: {
                userId,
                category,
                topic
            }
        });
    } catch (error) {
        console.error('Error saving recent topic:', error);
        // Non-critical error, don't throw
    }
}

/**
 * Clean up topics older than 30 days
 */
export async function cleanupOldTopics(): Promise<void> {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        await prisma.recentTopic.deleteMany({
            where: {
                createdAt: {
                    lt: thirtyDaysAgo
                }
            }
        });
    } catch (error) {
        console.error('Error cleaning up old topics:', error);
    }
}
