/**
 * Hand-written demo profiles (D-008). Deterministic: fixed ids, fixed order,
 * so the demo and the tests are reproducible.
 */

/** Fixed vocabulary so interest chips render consistently in the UI. */
export const INTERESTS = [
  'Music', 'Travel', 'Photography', 'Cricket', 'Football',
  'Gaming', 'Coding', 'Startups', 'Reading', 'Poetry',
  'Anime', 'Movies', 'Stand-up', 'Dance', 'Fitness',
  'Yoga', 'Cooking', 'Coffee', 'Street food', 'Trekking',
  'Art', 'Fashion', 'Debating', 'Thrifting', 'K-drama',
] as const;

export type Interest = (typeof INTERESTS)[number];

export interface SeedProfile {
  id: string;
  name: string;
  age: number;
  bio: string;
  photoUrl: string;
  city: string;
  college: string;
  interests: Interest[];
}

// Q-2 (open): placeholder portraits from randomuser.me. Swap here if we move
// to locally committed avatars.
const photo = (g: 'women' | 'men', n: number) =>
  `https://randomuser.me/api/portraits/${g}/${n}.jpg`;

type Row = [string, number, 'women' | 'men', number, string, string, string, Interest[]];

// [name, age, photo gender, photo #, city, college, bio, interests]
const ROWS: Row[] = [
  ['Priya', 21, 'women', 12, 'Delhi', 'Delhi University', 'Hansraj by day, Hauz Khas open mics by night. Will judge your chai order.', ['Poetry', 'Stand-up', 'Coffee']],
  ['Arjun', 22, 'men', 14, 'Mumbai', 'IIT Bombay', 'Building a startup nobody asked for. Ask me about Powai lake sunsets.', ['Startups', 'Coding', 'Football']],
  ['Ananya', 20, 'women', 21, 'Bangalore', 'Christ University', 'Thrift store hunter. My playlist has a song for every auto ride.', ['Thrifting', 'Music', 'Fashion']],
  ['Rohan', 23, 'men', 22, 'Pune', 'COEP', 'Weekend trekker, weekday debugger. Sinhagad at 5am, anyone?', ['Trekking', 'Coding', 'Coffee']],
  ['Ishita', 19, 'women', 33, 'Mumbai', 'NMIMS', 'First-year, full-time K-drama critic. Let me recommend you one.', ['K-drama', 'Dance', 'Street food']],
  ['Kabir', 24, 'men', 36, 'Delhi', 'IIT Delhi', 'Final year, final boss of the hostel FIFA league.', ['Gaming', 'Football', 'Movies']],
  ['Meera', 22, 'women', 44, 'Bangalore', 'IISc Bangalore', 'Research by day, baking sourdough at 2am. Mostly failing at both.', ['Cooking', 'Reading', 'Coffee']],
  ['Vihaan', 20, 'men', 41, 'Mumbai', 'St. Xavier\'s College', 'Street photographer. Bandra walls are my gallery.', ['Photography', 'Art', 'Street food']],
  ['Sanya', 21, 'women', 47, 'Pune', 'Symbiosis', 'Debate captain. I will argue with you about pineapple on pizza.', ['Debating', 'Reading', 'Travel']],
  ['Aditya', 25, 'men', 52, 'Bangalore', 'IIM Bangalore', 'MBA, ex-engineer, still writes Python for fun.', ['Startups', 'Fitness', 'Travel']],
  ['Tara', 23, 'women', 55, 'Delhi', 'NIFT Delhi', 'Designing clothes, drawing on napkins, collecting old film cameras.', ['Fashion', 'Art', 'Photography']],
  ['Dev', 21, 'men', 58, 'Pune', 'BITS Pilani Goa', 'Goa campus, Pune heart. Guitar, beaches and bad puns.', ['Music', 'Travel', 'Stand-up']],
  ['Aisha', 20, 'women', 62, 'Mumbai', 'Jai Hind College', 'Kathak trained, Bollywood obsessed. Marine Drive is my therapy.', ['Dance', 'Movies', 'Music']],
  ['Neel', 22, 'men', 63, 'Delhi', 'Delhi Technological University', 'Competitive programmer. Will trade leetcode tips for momos.', ['Coding', 'Street food', 'Gaming']],
  ['Kavya', 24, 'women', 65, 'Bangalore', 'NLSIU', 'Law student who reads thrillers to relax. Yes, really.', ['Reading', 'Debating', 'Yoga']],
  ['Yash', 19, 'men', 67, 'Mumbai', 'IIT Bombay', 'Fresher. Still finding my way around campus. And life.', ['Cricket', 'Anime', 'Gaming']],
  ['Riya', 22, 'women', 68, 'Pune', 'Fergusson College', 'Psych major. I will analyse your music taste.', ['Music', 'Reading', 'Coffee']],
  ['Aryan', 23, 'men', 71, 'Bangalore', 'RV College of Engineering', 'Gym at 6, code at 9, Koramangala cafes at 7pm.', ['Fitness', 'Coding', 'Coffee']],
  ['Diya', 21, 'women', 72, 'Delhi', 'Lady Shri Ram College', 'Economics, Urdu poetry, and very strong opinions about rajma.', ['Poetry', 'Cooking', 'Debating']],
  ['Karan', 26, 'men', 75, 'Mumbai', 'NMIMS', 'Stand-up comic in training. Laugh or I will explain the joke.', ['Stand-up', 'Movies', 'Cricket']],
  ['Nisha', 20, 'women', 76, 'Bangalore', 'Mount Carmel College', 'Anime + art. Currently sketching every cat in Indiranagar.', ['Anime', 'Art', 'Photography']],
  ['Siddharth', 22, 'men', 79, 'Pune', 'Symbiosis', 'Ultimate frisbee and filter coffee. Looking for a trek buddy.', ['Trekking', 'Coffee', 'Fitness']],
  ['Zara', 23, 'women', 81, 'Mumbai', 'St. Xavier\'s College', 'Film student. My Letterboxd is more honest than my diary.', ['Movies', 'Photography', 'Poetry']],
  ['Rahul', 21, 'men', 82, 'Delhi', 'Delhi University', 'SRCC. Cricket captain, part-time chef, full-time foodie.', ['Cricket', 'Cooking', 'Street food']],
  ['Pooja', 25, 'women', 84, 'Pune', 'IISER Pune', 'PhD in biology, side quest in yoga teaching.', ['Yoga', 'Reading', 'Trekking']],
  ['Ishaan', 20, 'men', 85, 'Bangalore', 'Christ University', 'Producer of beats nobody has heard yet. Soon.', ['Music', 'Gaming', 'Fashion']],
  ['Simran', 22, 'women', 87, 'Delhi', 'IIIT Delhi', 'Hackathon regular. Will build you an app for our first date.', ['Coding', 'Startups', 'K-drama']],
  ['Manav', 24, 'men', 88, 'Mumbai', 'VJTI', 'Football on Sundays, Marvel marathons the rest of the week.', ['Football', 'Movies', 'Fitness']],
  ['Aditi', 19, 'women', 89, 'Bangalore', 'PES University', 'Dancer, dreamer, part-time plant mom.', ['Dance', 'Art', 'Yoga']],
  ['Varun', 23, 'men', 91, 'Pune', 'COEP', 'Robotics club. My robot has more friends than me.', ['Coding', 'Anime', 'Trekking']],
  ['Naina', 21, 'women', 92, 'Mumbai', 'Mithibai College', 'Theatre kid forever. Tell me your favourite play.', ['Dance', 'Poetry', 'Fashion']],
  ['Harsh', 22, 'men', 93, 'Delhi', 'Ashoka University', 'Philosophy major. Ask me why, I dare you.', ['Debating', 'Reading', 'Coffee']],
  ['Myra', 20, 'women', 94, 'Pune', 'Flame University', 'Travel vlogger with 43 subscribers. Be the 44th.', ['Travel', 'Photography', 'Street food']],
  ['Kunal', 25, 'men', 95, 'Bangalore', 'IIIT Bangalore', 'Backend dev. I name my servers after cricketers.', ['Coding', 'Cricket', 'Gaming']],
  ['Sneha', 23, 'women', 95, 'Delhi', 'Jamia Millia Islamia', 'Architecture student. Old Delhi lanes are my sketchbook.', ['Art', 'Street food', 'Photography']],
  ['Aarav', 21, 'men', 96, 'Mumbai', 'NMIMS', 'Fitness freak with a weakness for vada pav.', ['Fitness', 'Street food', 'Music']],
];

export const SEED_PROFILES: SeedProfile[] = ROWS.map(
  ([name, age, g, n, city, college, bio, interests], i) => ({
    id: `p${String(i + 1).padStart(2, '0')}`,
    name,
    age,
    bio,
    photoUrl: photo(g, n),
    city,
    college,
    interests,
  }),
);

/** The logged-in user. Never shown in their own feed. */
export const ME: SeedProfile = {
  id: 'me',
  name: 'You',
  age: 21,
  bio: 'Just here to swipe.',
  photoUrl: photo('men', 1),
  city: 'Delhi',
  college: 'Delhi University',
  interests: ['Music', 'Coffee', 'Travel'],
};

/**
 * Profiles that have already liked `me` (12 of 36, about a third, so matches
 * happen often enough in the demo even with a privacy-safe shuffle, D-005).
 * Spread across the list on purpose.
 */
export const INCOMING_LIKE_IDS = [
  'p01', 'p04', 'p07', 'p10', 'p13', 'p16',
  'p19', 'p22', 'p25', 'p28', 'p31', 'p34',
] as const;

/**
 * Profiles that have already passed on `me`. These must stay in my feed and
 * behave exactly like strangers (D-006): proof that rejections never leak.
 */
export const INCOMING_PASS_IDS = ['p02', 'p09', 'p20', 'p33'] as const;
