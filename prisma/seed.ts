/**
 * EduScore Lebanon – Large Development Seed
 * Generates a realistic, large-scale dataset for development & demo purposes.
 * Target: ~10 universities, ~200+ professors, ~300+ courses, ~1000+ reviews
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Name pools ─────────────────────────────────────────────────────────────────
const MALE_FIRST = [
  'Ahmad', 'Ali', 'Antoine', 'Bilal', 'Charles', 'Charbel', 'Dany', 'Elie',
  'Fadi', 'Georges', 'Ghassan', 'Habib', 'Hassan', 'Ibrahim', 'Jad', 'Joseph',
  'Karim', 'Khalil', 'Marc', 'Mario', 'Nader', 'Nicolas', 'Omar', 'Patrick',
  'Pierre', 'Rabih', 'Sami', 'Samir', 'Tarek', 'Tony', 'Wadih', 'Youssef', 'Ziad',
]
const FEMALE_FIRST = [
  'Aida', 'Carla', 'Christine', 'Dalia', 'Dana', 'Elsa', 'Farah', 'Grace',
  'Hana', 'Joanna', 'Karine', 'Lara', 'Layla', 'Maya', 'Nada', 'Rania',
  'Rima', 'Sara', 'Tania', 'Yasmine', 'Zeina',
]
const ALL_FIRST = [...MALE_FIRST, ...FEMALE_FIRST]
const LAST_NAMES = [
  'Abboud', 'Abou-Jaoude', 'Abi-Nader', 'Assaf', 'Barakat', 'Boutros',
  'Chahal', 'Chehade', 'Daher', 'Doueihy', 'Eid', 'Fadel', 'Ghanem',
  'Habib', 'Haddad', 'Hajj', 'Ibrahim', 'Jaber', 'Khalil', 'Khoury',
  'Lahoud', 'Mansour', 'Maroun', 'Nasr', 'Nasser', 'Obeid', 'Pharaon',
  'Rahme', 'Rizk', 'Saad', 'Sakr', 'Sarkis', 'Sleiman', 'Tannous',
  'Touma', 'Wehbe', 'Yazbek', 'Youssef', 'Zantout', 'Zgheib',
]
const TITLES = ['Dr.', 'Dr.', 'Dr.', 'Prof.', 'Prof.', 'Eng.']

// Name generator (offset per university so no duplicates across universities)
function generateProfessorNames(count: number, offset: number): Array<{firstName: string; lastName: string; title: string}> {
  const total = ALL_FIRST.length * LAST_NAMES.length
  const result = []
  for (let i = 0; i < count; i++) {
    const idx = (offset + i * 7) % total
    const firstIdx = idx % ALL_FIRST.length
    const lastIdx = Math.floor(idx / ALL_FIRST.length) % LAST_NAMES.length
    result.push({
      firstName: ALL_FIRST[firstIdx],
      lastName: LAST_NAMES[lastIdx],
      title: TITLES[i % TITLES.length],
    })
  }
  return result
}

// ── Meeting time templates ─────────────────────────────────────────────────────
const TIME_SLOTS = [
  { days: ['MON', 'WED'],        start: '08:00', end: '09:30' },
  { days: ['MON', 'WED'],        start: '09:30', end: '11:00' },
  { days: ['MON', 'WED'],        start: '11:00', end: '12:30' },
  { days: ['MON', 'WED'],        start: '13:00', end: '14:30' },
  { days: ['MON', 'WED'],        start: '14:30', end: '16:00' },
  { days: ['MON', 'WED'],        start: '16:00', end: '17:30' },
  { days: ['TUE', 'THU'],        start: '08:00', end: '09:30' },
  { days: ['TUE', 'THU'],        start: '09:30', end: '11:00' },
  { days: ['TUE', 'THU'],        start: '11:00', end: '12:30' },
  { days: ['TUE', 'THU'],        start: '13:00', end: '14:30' },
  { days: ['TUE', 'THU'],        start: '14:30', end: '16:00' },
  { days: ['MON', 'WED', 'FRI'], start: '08:00', end: '09:00' },
  { days: ['MON', 'WED', 'FRI'], start: '09:00', end: '10:00' },
  { days: ['MON', 'WED', 'FRI'], start: '10:00', end: '11:00' },
  { days: ['MON', 'WED', 'FRI'], start: '11:00', end: '12:00' },
  { days: ['MON', 'WED', 'FRI'], start: '12:00', end: '13:00' },
]

// ── Review templates ───────────────────────────────────────────────────────────
type ReviewTemplate = {
  overallRating: number; teachingClarity: number; workloadLevel: number
  gradingFairness: number; attendanceStrict: number; examDifficulty: number
  participation: number; wouldRecommend: boolean; grade: string
  body: string; pros: string; cons: string
}

function generateReview(seed: number, profName: string, uniShort: string): ReviewTemplate {
  const tier = seed % 5 // 0-4: determines quality tier
  const r = (base: number, v: number) => Math.max(1, Math.min(5, base + ((seed * v) % 3) - 1))

  if (tier <= 1) { // Great professor (40% chance)
    const overall = 4 + (seed % 2)
    return {
      overallRating: overall, teachingClarity: r(4, 3), workloadLevel: r(3, 2),
      gradingFairness: r(4, 5), attendanceStrict: r(2, 7), examDifficulty: r(3, 3),
      participation: r(3, 4), wouldRecommend: true, grade: ['A', 'A+', 'A-', 'B+'][seed % 4],
      body: [
        `${profName} is one of the most dedicated professors at ${uniShort}. The lectures are well-structured and the explanations are incredibly clear. Office hours are genuinely helpful and the professor goes beyond what is required to ensure students understand. Exams are fair and directly test the material taught.`,
        `Excellent professor. ${profName} makes complex topics accessible and keeps the class engaging throughout the semester. Grading is transparent and the professor rewards genuine effort. One of the best courses I have taken at ${uniShort}.`,
        `I cannot recommend ${profName} enough. The professor has deep expertise in the subject and communicates it brilliantly. The workload is reasonable and the assignments directly reinforce lecture content. Always available to help students outside of class.`,
        `${profName} genuinely cares about student success. The teaching style is interactive and students are encouraged to ask questions. The course is well-organized with clear expectations from day one. Would take any other course taught by this professor.`,
      ][seed % 4],
      pros: ['Clear explanations, fair exams, accessible', 'Organized, engaging, helpful', 'Expert knowledge, patient, supportive', 'Inspiring, well-structured, fair grader'][seed % 4],
      cons: ['Popular office hours can fill up before exams', 'Lectures can run slightly over time', 'Attendance expected even when slides are posted online', 'Highly popular section — register early'][seed % 4],
    }
  } else if (tier <= 3) { // Average professor (40% chance)
    const overall = 3 + (seed % 2)
    return {
      overallRating: overall, teachingClarity: r(3, 2), workloadLevel: r(3, 3),
      gradingFairness: r(3, 4), attendanceStrict: r(3, 5), examDifficulty: r(3, 2),
      participation: r(3, 6), wouldRecommend: overall >= 4, grade: ['B', 'B+', 'B-', 'A-', 'C+'][seed % 5],
      body: [
        `${profName} is an average professor. The material is covered adequately but lectures can sometimes be dry. Exams are of moderate difficulty. Worth taking if no better option is available at ${uniShort}.`,
        `Decent professor overall. ${profName} covers the syllabus but does not go much beyond it. The workload is manageable. Could improve student engagement during lectures.`,
        `The course with ${profName} was okay. Some topics were explained clearly, others required extra self-study. Grading is straightforward. A solid but unremarkable teaching experience.`,
        `${profName} has good knowledge of the subject but the teaching style takes time to get used to. Slides are well-organized. The midterm was harder than expected but finals were reasonable.`,
      ][seed % 4],
      pros: ['Knowledgeable, organized slides', 'Fair grading, predictable exams', 'Clear syllabus, reasonable workload', 'Available for questions, decent explanations'][seed % 4],
      cons: ['Lectures can be dry, limited interaction', 'Exams harder than practice material', 'Attendance strictly enforced', 'Could be more engaging in class'][seed % 4],
    }
  } else { // Tough professor (20% chance)
    return {
      overallRating: 2 + (seed % 2), teachingClarity: r(2, 3), workloadLevel: r(4, 2),
      gradingFairness: r(2, 5), attendanceStrict: r(4, 4), examDifficulty: r(4, 3),
      participation: r(2, 6), wouldRecommend: false, grade: ['C', 'C+', 'B-', 'D'][seed % 4],
      body: [
        `Challenging course with ${profName}. The workload is significantly heavier than comparable courses at ${uniShort}. Exams test material that was not clearly covered in lectures. Would recommend alternative sections if available.`,
        `${profName} is a tough professor. Strict attendance policy and heavy grading make this one of the harder courses to pass. The professor knows the subject well but does not adapt teaching to student needs.`,
        `Difficult experience overall. ${profName} moves very quickly through material and expects students to keep up independently. Office hours help but the exams are still harder than expected.`,
      ][seed % 3],
      pros: ['Thorough subject knowledge', 'Comprehensive course content', 'Prepares you well for advanced courses'][seed % 3],
      cons: ['Very heavy workload, harsh grading', 'Exams harder than covered material, strict attendance', 'Fast-paced, limited support outside class'][seed % 3],
    }
  }
}

// ── Course catalogs by department type ───────────────────────────────────────
type CourseEntry = { code: string; name: string; credits: number; description: string; level?: string }

const COURSE_CATALOGS: Record<string, CourseEntry[]> = {
  CMPS: [
    { code: 'CMPS 200', name: 'Introduction to Computer Science', credits: 3, description: 'Overview of computing concepts and programming fundamentals.' },
    { code: 'CMPS 201', name: 'Data Structures', credits: 3, description: 'Fundamental data structures: lists, stacks, queues, trees, graphs.' },
    { code: 'CMPS 202', name: 'Algorithms', credits: 3, description: 'Algorithm design, complexity, and analysis.' },
    { code: 'CMPS 203', name: 'Operating Systems', credits: 3, description: 'Process management, memory, file systems.' },
    { code: 'CMPS 204', name: 'Database Systems', credits: 3, description: 'Relational databases, SQL, transactions.' },
    { code: 'CMPS 205', name: 'Computer Networks', credits: 3, description: 'Network protocols, TCP/IP, security.' },
    { code: 'CMPS 206', name: 'Software Engineering', credits: 3, description: 'SDLC, design patterns, testing.' },
    { code: 'CMPS 207', name: 'Artificial Intelligence', credits: 3, description: 'Search, knowledge representation, machine learning.' },
    { code: 'CMPS 300', name: 'Computer Architecture', credits: 3, description: 'CPU design, memory hierarchy, instruction sets.' },
    { code: 'CMPS 301', name: 'Programming Languages', credits: 3, description: 'Language paradigms, compilers, interpreters.' },
    { code: 'CMPS 302', name: 'Web Development', credits: 3, description: 'Full-stack web technologies, frameworks, APIs.' },
    { code: 'CMPS 303', name: 'Cybersecurity', credits: 3, description: 'Cryptography, network security, ethical hacking.' },
    { code: 'CMPS 400', name: 'Machine Learning', credits: 3, description: 'Supervised and unsupervised learning, neural networks.' },
    { code: 'CMPS 401', name: 'Cloud Computing', credits: 3, description: 'Cloud architectures, containers, serverless.' },
    { code: 'CMPS 499', name: 'Senior Capstone Project', credits: 6, description: 'Independent project integrating course knowledge.' },
  ],
  MATH: [
    { code: 'MATH 200', name: 'Pre-Calculus', credits: 3, description: 'Functions, trigonometry, algebra review.' },
    { code: 'MATH 201', name: 'Calculus I', credits: 3, description: 'Limits, derivatives, integrals.' },
    { code: 'MATH 202', name: 'Calculus II', credits: 3, description: 'Integration techniques, series.' },
    { code: 'MATH 203', name: 'Calculus III', credits: 3, description: 'Multivariable calculus, vector analysis.' },
    { code: 'MATH 204', name: 'Linear Algebra', credits: 3, description: 'Matrices, vector spaces, eigenvalues.' },
    { code: 'MATH 205', name: 'Differential Equations', credits: 3, description: 'ODEs and their applications.' },
    { code: 'MATH 206', name: 'Discrete Mathematics', credits: 3, description: 'Logic, combinatorics, graph theory.' },
    { code: 'MATH 300', name: 'Probability & Statistics', credits: 3, description: 'Probability theory and statistical inference.' },
    { code: 'MATH 301', name: 'Numerical Methods', credits: 3, description: 'Computational mathematics and approximation.' },
    { code: 'MATH 302', name: 'Real Analysis', credits: 3, description: 'Rigorous calculus: sequences, continuity, integration.' },
    { code: 'MATH 400', name: 'Abstract Algebra', credits: 3, description: 'Groups, rings, fields, and homomorphisms.' },
  ],
  EECE: [
    { code: 'EECE 230', name: 'Electric Circuits I', credits: 3, description: 'DC circuit analysis fundamentals.' },
    { code: 'EECE 231', name: 'Electric Circuits II', credits: 3, description: 'AC circuits, phasors, power.' },
    { code: 'EECE 330', name: 'Signals & Systems', credits: 3, description: 'Continuous and discrete-time signal analysis.' },
    { code: 'EECE 331', name: 'Digital Systems', credits: 3, description: 'Boolean logic, combinational and sequential design.' },
    { code: 'EECE 332', name: 'Electronics I', credits: 3, description: 'Diodes, transistors, amplifier circuits.' },
    { code: 'EECE 333', name: 'Electronics II', credits: 3, description: 'Operational amplifiers, feedback systems.' },
    { code: 'EECE 430', name: 'Electromagnetic Fields', credits: 3, description: 'Maxwell equations, wave propagation.' },
    { code: 'EECE 431', name: 'Communication Systems', credits: 3, description: 'Modulation, demodulation, channel capacity.' },
    { code: 'EECE 432', name: 'Control Systems', credits: 3, description: 'Feedback control, stability, Bode plots.' },
    { code: 'EECE 440', name: 'VLSI Design', credits: 3, description: 'CMOS circuits, chip design, layout.' },
  ],
  BUSS: [
    { code: 'BUSS 200', name: 'Introduction to Business', credits: 3, description: 'Business functions and environment overview.' },
    { code: 'BUSS 210', name: 'Principles of Management', credits: 3, description: 'Management theory, leadership, organizational behavior.' },
    { code: 'BUSS 220', name: 'Principles of Marketing', credits: 3, description: 'Marketing strategy, consumer behavior.' },
    { code: 'BUSS 230', name: 'Business Finance', credits: 3, description: 'Financial analysis, time value, capital budgeting.' },
    { code: 'BUSS 240', name: 'Business Statistics', credits: 3, description: 'Descriptive and inferential statistics for business.' },
    { code: 'BUSS 300', name: 'Managerial Accounting', credits: 3, description: 'Cost analysis, budgeting, variance analysis.' },
    { code: 'BUSS 310', name: 'Business Law', credits: 3, description: 'Legal environment of business in Lebanon.' },
    { code: 'BUSS 320', name: 'Operations Management', credits: 3, description: 'Process design, supply chain, quality.' },
    { code: 'BUSS 330', name: 'Strategic Management', credits: 3, description: 'Competitive strategy, industry analysis.' },
    { code: 'BUSS 400', name: 'Entrepreneurship', credits: 3, description: 'Startup creation, business planning, funding.' },
    { code: 'BUSS 410', name: 'Business Ethics', credits: 3, description: 'Ethical frameworks, CSR, corporate governance.' },
  ],
  ACCT: [
    { code: 'ACCT 200', name: 'Financial Accounting I', credits: 3, description: 'Basic accounting concepts, financial statements.' },
    { code: 'ACCT 201', name: 'Financial Accounting II', credits: 3, description: 'Advanced topics: consolidations, leases.' },
    { code: 'ACCT 300', name: 'Cost Accounting', credits: 3, description: 'Job costing, process costing, ABC.' },
    { code: 'ACCT 301', name: 'Auditing', credits: 3, description: 'Audit process, evidence, internal controls.' },
    { code: 'ACCT 400', name: 'Tax Accounting', credits: 3, description: 'Lebanese tax law and compliance.' },
    { code: 'ACCT 401', name: 'Advanced Financial Reporting', credits: 3, description: 'IFRS standards, complex transactions.' },
  ],
  CVLE: [
    { code: 'CVLE 200', name: 'Engineering Mechanics', credits: 3, description: 'Statics and dynamics fundamentals.' },
    { code: 'CVLE 210', name: 'Mechanics of Materials', credits: 3, description: 'Stress, strain, structural analysis.' },
    { code: 'CVLE 300', name: 'Fluid Mechanics', credits: 3, description: 'Fluid statics, dynamics, pipe flow.' },
    { code: 'CVLE 310', name: 'Structural Analysis', credits: 3, description: 'Beams, frames, trusses under load.' },
    { code: 'CVLE 320', name: 'Geotechnical Engineering', credits: 3, description: 'Soil mechanics, foundations, slopes.' },
    { code: 'CVLE 400', name: 'Reinforced Concrete Design', credits: 3, description: 'RC structural design per code.' },
    { code: 'CVLE 401', name: 'Steel Structures', credits: 3, description: 'Steel connection and member design.' },
    { code: 'CVLE 410', name: 'Transportation Engineering', credits: 3, description: 'Traffic flow, highway design, pavement.' },
    { code: 'CVLE 420', name: 'Environmental Engineering', credits: 3, description: 'Water treatment, waste management, pollution.' },
  ],
  MCHE: [
    { code: 'MCHE 200', name: 'Engineering Drawing', credits: 2, description: 'Technical drawing, CAD fundamentals.' },
    { code: 'MCHE 210', name: 'Thermodynamics I', credits: 3, description: 'Heat, work, first and second laws.' },
    { code: 'MCHE 211', name: 'Thermodynamics II', credits: 3, description: 'Power cycles, refrigeration, mixtures.' },
    { code: 'MCHE 300', name: 'Fluid Mechanics', credits: 3, description: 'Viscous flow, turbomachinery.' },
    { code: 'MCHE 310', name: 'Heat Transfer', credits: 3, description: 'Conduction, convection, radiation.' },
    { code: 'MCHE 320', name: 'Machine Design', credits: 3, description: 'Mechanical component design and failure analysis.' },
    { code: 'MCHE 400', name: 'Manufacturing Processes', credits: 3, description: 'Machining, casting, welding, automation.' },
    { code: 'MCHE 410', name: 'Vibrations', credits: 3, description: 'Free and forced vibrations, damping.' },
  ],
  ECON: [
    { code: 'ECON 200', name: 'Microeconomics', credits: 3, description: 'Supply, demand, market structures.' },
    { code: 'ECON 201', name: 'Macroeconomics', credits: 3, description: 'National income, inflation, monetary policy.' },
    { code: 'ECON 300', name: 'Intermediate Microeconomics', credits: 3, description: 'Consumer theory, producer theory, welfare.' },
    { code: 'ECON 301', name: 'Intermediate Macroeconomics', credits: 3, description: 'IS-LM, AD-AS, growth models.' },
    { code: 'ECON 310', name: 'Econometrics', credits: 3, description: 'OLS regression, time series, hypothesis testing.' },
    { code: 'ECON 400', name: 'Development Economics', credits: 3, description: 'Economic development theories and Lebanon.' },
  ],
  PHYS: [
    { code: 'PHYS 201', name: 'Physics I: Mechanics', credits: 3, description: 'Kinematics, dynamics, energy, momentum.' },
    { code: 'PHYS 202', name: 'Physics II: E&M', credits: 3, description: 'Electricity, magnetism, Maxwell equations.' },
    { code: 'PHYS 203', name: 'Modern Physics', credits: 3, description: 'Relativity, quantum mechanics, atomic physics.' },
    { code: 'PHYS 300', name: 'Classical Mechanics', credits: 3, description: 'Lagrangian and Hamiltonian mechanics.' },
    { code: 'PHYS 400', name: 'Quantum Mechanics', credits: 3, description: 'Schrödinger equation, operators, perturbation theory.' },
  ],
  ARCH: [
    { code: 'ARCH 200', name: 'Architectural Design I', credits: 6, description: 'Studio: fundamental design principles.' },
    { code: 'ARCH 201', name: 'Architectural Design II', credits: 6, description: 'Studio: complex program and site.' },
    { code: 'ARCH 300', name: 'History of Architecture', credits: 3, description: 'Architecture from antiquity to modernity.' },
    { code: 'ARCH 310', name: 'Building Technology', credits: 3, description: 'Construction systems and materials.' },
    { code: 'ARCH 320', name: 'Urban Design', credits: 3, description: 'City planning, public space, zoning.' },
    { code: 'ARCH 400', name: 'Thesis Project', credits: 9, description: 'Final design research and project.' },
  ],
  FMSE: [
    { code: 'FMSE 300', name: 'Corporate Finance', credits: 3, description: 'Capital structure, valuation, M&A.' },
    { code: 'FMSE 310', name: 'Investments', credits: 3, description: 'Portfolio theory, asset pricing, derivatives.' },
    { code: 'FMSE 320', name: 'Financial Markets', credits: 3, description: 'Equity, fixed income, and derivative markets.' },
    { code: 'FMSE 400', name: 'Risk Management', credits: 3, description: 'Financial risk: credit, market, operational.' },
    { code: 'FMSE 410', name: 'International Finance', credits: 3, description: 'FX, global capital flows, hedging.' },
  ],
  MKTG: [
    { code: 'MKTG 300', name: 'Consumer Behavior', credits: 3, description: 'Psychological and social influences on buying.' },
    { code: 'MKTG 310', name: 'Digital Marketing', credits: 3, description: 'SEO, SEM, social media, analytics.' },
    { code: 'MKTG 320', name: 'Brand Management', credits: 3, description: 'Brand equity, positioning, architecture.' },
    { code: 'MKTG 400', name: 'Marketing Research', credits: 3, description: 'Surveys, focus groups, data analysis.' },
    { code: 'MKTG 410', name: 'International Marketing', credits: 3, description: 'Global strategy, cultural adaptation.' },
  ],
  BIO: [
    { code: 'BIOL 200', name: 'General Biology I', credits: 3, description: 'Cell biology, genetics, evolution.' },
    { code: 'BIOL 201', name: 'General Biology II', credits: 3, description: 'Ecology, physiology, diversity of life.' },
    { code: 'BIOL 300', name: 'Molecular Biology', credits: 3, description: 'DNA replication, transcription, translation.' },
    { code: 'BIOL 310', name: 'Biochemistry', credits: 3, description: 'Metabolism, enzymology, bioenergetics.' },
  ],
  PSYC: [
    { code: 'PSYC 200', name: 'Introduction to Psychology', credits: 3, description: 'Major areas of psychology and human behavior.' },
    { code: 'PSYC 300', name: 'Developmental Psychology', credits: 3, description: 'Human development across the lifespan.' },
    { code: 'PSYC 310', name: 'Abnormal Psychology', credits: 3, description: 'Psychological disorders and treatment.' },
    { code: 'PSYC 400', name: 'Research Methods in Psychology', credits: 3, description: 'Experimental design and statistics.' },
  ],
  CHEM: [
    { code: 'CHEM 201', name: 'General Chemistry I', credits: 3, description: 'Atomic structure, bonding, stoichiometry.' },
    { code: 'CHEM 202', name: 'General Chemistry II', credits: 3, description: 'Equilibrium, kinetics, electrochemistry.' },
    { code: 'CHEM 300', name: 'Organic Chemistry I', credits: 3, description: 'Carbon chemistry, functional groups.' },
    { code: 'CHEM 301', name: 'Organic Chemistry II', credits: 3, description: 'Reactions, spectroscopy, synthesis.' },
  ],
  GEN: [
    { code: 'GEN 100', name: 'Critical Thinking', credits: 3, description: 'Logic, argumentation, problem-solving.' },
    { code: 'GEN 101', name: 'Academic Writing', credits: 3, description: 'Essay writing, research, academic style.' },
    { code: 'GEN 200', name: 'Research Methods', credits: 3, description: 'Research design, data collection, analysis.' },
  ],
  INFO: [
    { code: 'INFO 100', name: 'Introduction to IT', credits: 3, description: 'Computer systems and information technology.' },
    { code: 'INFO 200', name: 'Programming I', credits: 3, description: 'Python or Java programming fundamentals.' },
    { code: 'INFO 201', name: 'Programming II', credits: 3, description: 'OOP, data structures.' },
    { code: 'INFO 300', name: 'Database Management', credits: 3, description: 'Database design, SQL, normalization.' },
    { code: 'INFO 310', name: 'Systems Analysis', credits: 3, description: 'Requirements, modeling, design.' },
    { code: 'INFO 400', name: 'IT Project Management', credits: 3, description: 'Project planning, Agile, risk management.' },
    { code: 'INFO 410', name: 'E-Commerce Systems', credits: 3, description: 'Online business models and technologies.' },
    { code: 'INFO 420', name: 'Information Security', credits: 3, description: 'Security principles, threats, controls.' },
  ],
}

// ── University configuration ───────────────────────────────────────────────────
type DeptConfig = {
  name: string; slug: string; code: string; professorCount: number; catalogKey: string
}
type FacultyConfig = {
  name: string; slug: string; departments: DeptConfig[]
}
type UniConfig = {
  name: string; shortName: string; slug: string; city: string
  website: string; description: string; registrationModel: string
  faculties: FacultyConfig[]
}

const UNIVERSITIES: UniConfig[] = [
  {
    name: 'American University of Beirut', shortName: 'AUB', slug: 'aub', city: 'Beirut',
    website: 'https://www.aub.edu.lb', registrationModel: 'FLEXIBLE',
    description: 'Founded in 1866, AUB is a leading research university in the Middle East, offering world-class education in a liberal arts tradition.',
    faculties: [
      { name: 'Faculty of Arts & Sciences', slug: 'fas', departments: [
        { name: 'Computer Science', slug: 'cs', code: 'CMPS', professorCount: 10, catalogKey: 'CMPS' },
        { name: 'Mathematics', slug: 'math', code: 'MATH', professorCount: 8, catalogKey: 'MATH' },
        { name: 'Physics', slug: 'physics', code: 'PHYS', professorCount: 6, catalogKey: 'PHYS' },
        { name: 'Chemistry', slug: 'chemistry', code: 'CHEM', professorCount: 5, catalogKey: 'CHEM' },
        { name: 'Biology', slug: 'biology', code: 'BIOL', professorCount: 5, catalogKey: 'BIO' },
        { name: 'Economics', slug: 'economics', code: 'ECON', professorCount: 6, catalogKey: 'ECON' },
        { name: 'Psychology', slug: 'psychology', code: 'PSYC', professorCount: 5, catalogKey: 'PSYC' },
      ]},
      { name: 'Maroun Semaan Faculty of Engineering & Architecture', slug: 'msfea', departments: [
        { name: 'Electrical & Computer Engineering', slug: 'ece', code: 'EECE', professorCount: 10, catalogKey: 'EECE' },
        { name: 'Civil & Environmental Engineering', slug: 'civil', code: 'CVLE', professorCount: 8, catalogKey: 'CVLE' },
        { name: 'Mechanical Engineering', slug: 'mech', code: 'MCHE', professorCount: 7, catalogKey: 'MCHE' },
        { name: 'Architecture & Design', slug: 'arch', code: 'ARCH', professorCount: 6, catalogKey: 'ARCH' },
      ]},
      { name: 'Suliman S. Olayan School of Business', slug: 'osb', departments: [
        { name: 'Business Administration', slug: 'buss', code: 'BUSS', professorCount: 8, catalogKey: 'BUSS' },
        { name: 'Finance & Management Science', slug: 'fmse', code: 'FMSE', professorCount: 6, catalogKey: 'FMSE' },
        { name: 'Marketing', slug: 'mktg', code: 'MKTG', professorCount: 5, catalogKey: 'MKTG' },
        { name: 'Accounting', slug: 'acct', code: 'ACCT', professorCount: 5, catalogKey: 'ACCT' },
      ]},
    ],
  },
  {
    name: 'Lebanese American University', shortName: 'LAU', slug: 'lau', city: 'Beirut / Byblos',
    website: 'https://www.lau.edu.lb', registrationModel: 'FLEXIBLE',
    description: 'A private university with campuses in Beirut and Byblos offering US-accredited degrees.',
    faculties: [
      { name: 'School of Arts & Sciences', slug: 'sas', departments: [
        { name: 'Computer Science & Mathematics', slug: 'csm', code: 'CMPS', professorCount: 8, catalogKey: 'CMPS' },
        { name: 'Natural Sciences', slug: 'nsc', code: 'PHYS', professorCount: 5, catalogKey: 'PHYS' },
        { name: 'Social Sciences', slug: 'ssc', code: 'ECON', professorCount: 5, catalogKey: 'ECON' },
      ]},
      { name: 'School of Engineering', slug: 'soe', departments: [
        { name: 'Electrical & Computer Engineering', slug: 'ece', code: 'EECE', professorCount: 7, catalogKey: 'EECE' },
        { name: 'Civil Engineering', slug: 'civil', code: 'CVLE', professorCount: 6, catalogKey: 'CVLE' },
        { name: 'Industrial & Mechanical Engineering', slug: 'ime', code: 'MCHE', professorCount: 5, catalogKey: 'MCHE' },
      ]},
      { name: 'Adnan Kassar School of Business', slug: 'aksob', departments: [
        { name: 'Business Administration', slug: 'ba', code: 'BUSS', professorCount: 7, catalogKey: 'BUSS' },
        { name: 'Finance & Accounting', slug: 'fa', code: 'FMSE', professorCount: 5, catalogKey: 'FMSE' },
        { name: 'Marketing', slug: 'mkt', code: 'MKTG', professorCount: 4, catalogKey: 'MKTG' },
      ]},
      { name: 'School of Architecture & Design', slug: 'sad', departments: [
        { name: 'Architecture', slug: 'arch', code: 'ARCH', professorCount: 5, catalogKey: 'ARCH' },
      ]},
    ],
  },
  {
    name: "Université Saint-Joseph de Beyrouth", shortName: 'USJ', slug: 'usj', city: 'Beirut',
    website: 'https://www.usj.edu.lb', registrationModel: 'STRUCTURED',
    description: 'A private Francophone Jesuit university founded in 1875. Uses a structured course registration system via centralized timetables.',
    faculties: [
      { name: "Faculté des Sciences", slug: 'sciences', departments: [
        { name: 'Informatique', slug: 'info', code: 'INFO', professorCount: 6, catalogKey: 'INFO' },
        { name: 'Mathématiques', slug: 'math', code: 'MATH', professorCount: 5, catalogKey: 'MATH' },
        { name: 'Physique', slug: 'physique', code: 'PHYS', professorCount: 4, catalogKey: 'PHYS' },
        { name: 'Chimie', slug: 'chimie', code: 'CHEM', professorCount: 4, catalogKey: 'CHEM' },
      ]},
      { name: "Faculté de Gestion et de Management", slug: 'gestion', departments: [
        { name: 'Gestion', slug: 'gestion-dept', code: 'BUSS', professorCount: 6, catalogKey: 'BUSS' },
        { name: 'Comptabilité', slug: 'comptabilite', code: 'ACCT', professorCount: 4, catalogKey: 'ACCT' },
        { name: 'Finance', slug: 'finance', code: 'FMSE', professorCount: 4, catalogKey: 'FMSE' },
      ]},
      { name: "École Supérieure d'Ingénieurs de Beyrouth", slug: 'esib', departments: [
        { name: 'Génie Électrique', slug: 'genie-elec', code: 'EECE', professorCount: 7, catalogKey: 'EECE' },
        { name: 'Génie Civil', slug: 'genie-civil', code: 'CVLE', professorCount: 6, catalogKey: 'CVLE' },
      ]},
    ],
  },
  {
    name: 'Lebanese International University', shortName: 'LIU', slug: 'liu', city: 'Beirut',
    website: 'https://www.liu.edu.lb', registrationModel: 'FLEXIBLE',
    description: 'A private university offering affordable quality education across multiple campuses in Lebanon.',
    faculties: [
      { name: 'Faculty of Engineering', slug: 'eng', departments: [
        { name: 'Computer Engineering', slug: 'ce', code: 'CMPS', professorCount: 7, catalogKey: 'CMPS' },
        { name: 'Electrical Engineering', slug: 'ee', code: 'EECE', professorCount: 6, catalogKey: 'EECE' },
        { name: 'Civil Engineering', slug: 'civil', code: 'CVLE', professorCount: 5, catalogKey: 'CVLE' },
      ]},
      { name: 'Faculty of Business Administration', slug: 'fba', departments: [
        { name: 'Business Administration', slug: 'ba', code: 'BUSS', professorCount: 7, catalogKey: 'BUSS' },
        { name: 'Accounting', slug: 'acc', code: 'ACCT', professorCount: 5, catalogKey: 'ACCT' },
      ]},
      { name: 'Faculty of Information Technology', slug: 'fit', departments: [
        { name: 'Information Technology', slug: 'it', code: 'INFO', professorCount: 6, catalogKey: 'INFO' },
      ]},
    ],
  },
  {
    name: 'Notre Dame University - Louaize', shortName: 'NDU', slug: 'ndu', city: 'Zouk Mosbeh',
    website: 'https://www.ndu.edu.lb', registrationModel: 'FLEXIBLE',
    description: 'A private Catholic university in Louaize offering liberal arts and professional programs.',
    faculties: [
      { name: 'Faculty of Engineering', slug: 'eng', departments: [
        { name: 'Computer Science', slug: 'cs', code: 'CMPS', professorCount: 6, catalogKey: 'CMPS' },
        { name: 'Electrical Engineering', slug: 'ee', code: 'EECE', professorCount: 5, catalogKey: 'EECE' },
        { name: 'Civil Engineering', slug: 'civil', code: 'CVLE', professorCount: 5, catalogKey: 'CVLE' },
      ]},
      { name: 'Faculty of Business Administration & Economics', slug: 'fbae', departments: [
        { name: 'Business Administration', slug: 'ba', code: 'BUSS', professorCount: 6, catalogKey: 'BUSS' },
        { name: 'Economics', slug: 'eco', code: 'ECON', professorCount: 4, catalogKey: 'ECON' },
      ]},
      { name: 'Faculty of Architecture, Art & Design', slug: 'faad', departments: [
        { name: 'Architecture', slug: 'arch', code: 'ARCH', professorCount: 5, catalogKey: 'ARCH' },
      ]},
    ],
  },
  {
    name: 'Beirut Arab University', shortName: 'BAU', slug: 'bau', city: 'Beirut',
    website: 'https://www.bau.edu.lb', registrationModel: 'FLEXIBLE',
    description: 'A private university affiliated with the Arab Educational Institute offering diverse academic programs.',
    faculties: [
      { name: 'Faculty of Engineering', slug: 'eng', departments: [
        { name: 'Computer & Communications Engineering', slug: 'cce', code: 'CMPS', professorCount: 6, catalogKey: 'CMPS' },
        { name: 'Civil Engineering', slug: 'civil', code: 'CVLE', professorCount: 5, catalogKey: 'CVLE' },
        { name: 'Electrical Engineering', slug: 'ee', code: 'EECE', professorCount: 5, catalogKey: 'EECE' },
      ]},
      { name: 'Faculty of Business Administration', slug: 'fba', departments: [
        { name: 'Business Administration', slug: 'ba', code: 'BUSS', professorCount: 6, catalogKey: 'BUSS' },
        { name: 'Accounting & Finance', slug: 'af', code: 'ACCT', professorCount: 4, catalogKey: 'ACCT' },
      ]},
    ],
  },
  {
    name: 'Holy Spirit University of Kaslik', shortName: 'USEK', slug: 'usek', city: 'Kaslik',
    website: 'https://www.usek.edu.lb', registrationModel: 'FLEXIBLE',
    description: 'A private Catholic university in Kaslik known for business, engineering, and fine arts programs.',
    faculties: [
      { name: 'Faculty of Engineering & Architecture', slug: 'fea', departments: [
        { name: 'Computer Engineering', slug: 'ce', code: 'CMPS', professorCount: 5, catalogKey: 'CMPS' },
        { name: 'Civil Engineering', slug: 'civil', code: 'CVLE', professorCount: 4, catalogKey: 'CVLE' },
      ]},
      { name: 'Faculty of Business & Commercial Sciences', slug: 'fbcs', departments: [
        { name: 'Business Management', slug: 'bm', code: 'BUSS', professorCount: 5, catalogKey: 'BUSS' },
        { name: 'Accounting', slug: 'acc', code: 'ACCT', professorCount: 4, catalogKey: 'ACCT' },
      ]},
      { name: 'Faculty of Sciences', slug: 'fs', departments: [
        { name: 'Computer Science', slug: 'cs', code: 'INFO', professorCount: 4, catalogKey: 'INFO' },
      ]},
    ],
  },
  {
    name: 'Antonine University', shortName: 'UA', slug: 'ua', city: 'Baabda',
    website: 'https://www.ua.edu.lb', registrationModel: 'FLEXIBLE',
    description: 'A private Maronite university in Baabda known for its media, IT, and business programs.',
    faculties: [
      { name: 'Faculty of Engineering & Information Technology', slug: 'feit', departments: [
        { name: 'Computer Science', slug: 'cs', code: 'CMPS', professorCount: 5, catalogKey: 'CMPS' },
        { name: 'Information Systems', slug: 'is', code: 'INFO', professorCount: 4, catalogKey: 'INFO' },
      ]},
      { name: 'Faculty of Business Administration', slug: 'fba', departments: [
        { name: 'Business Administration', slug: 'ba', code: 'BUSS', professorCount: 5, catalogKey: 'BUSS' },
      ]},
    ],
  },
  {
    name: 'American University of Science and Technology', shortName: 'AUST', slug: 'aust', city: 'Achrafieh',
    website: 'https://www.aust.edu.lb', registrationModel: 'FLEXIBLE',
    description: 'A private university in Achrafieh offering US-system education in engineering and business.',
    faculties: [
      { name: 'Faculty of Engineering', slug: 'eng', departments: [
        { name: 'Computer Engineering', slug: 'ce', code: 'CMPS', professorCount: 5, catalogKey: 'CMPS' },
        { name: 'Electrical Engineering', slug: 'ee', code: 'EECE', professorCount: 4, catalogKey: 'EECE' },
      ]},
      { name: 'Faculty of Business', slug: 'fb', departments: [
        { name: 'Business Administration', slug: 'ba', code: 'BUSS', professorCount: 5, catalogKey: 'BUSS' },
        { name: 'Finance', slug: 'fin', code: 'FMSE', professorCount: 3, catalogKey: 'FMSE' },
      ]},
    ],
  },
  {
    name: 'Arab Open University – Lebanon', shortName: 'AOU', slug: 'aou', city: 'Beirut',
    website: 'https://www.aou.edu.lb', registrationModel: 'FLEXIBLE',
    description: 'Part of the Arab Open University network offering flexible distance and blended learning programs.',
    faculties: [
      { name: 'Faculty of Computing & Information Technology', slug: 'fcit', departments: [
        { name: 'Information Technology', slug: 'it', code: 'INFO', professorCount: 5, catalogKey: 'INFO' },
        { name: 'Computer Science', slug: 'cs', code: 'CMPS', professorCount: 4, catalogKey: 'CMPS' },
      ]},
      { name: 'Faculty of Business Studies', slug: 'fbs', departments: [
        { name: 'Business Administration', slug: 'ba', code: 'BUSS', professorCount: 5, catalogKey: 'BUSS' },
        { name: 'Accounting', slug: 'acc', code: 'ACCT', professorCount: 3, catalogKey: 'ACCT' },
      ]},
    ],
  },
]

// ── Seeding helpers ─────────────────────────────────────────────────────────────
async function slugify(base: string): Promise<string> {
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function uniqueSlug(base: string, table: 'professor'): Promise<string> {
  let slug = await slugify(base)
  let counter = 0
  while (await prisma.professor.findUnique({ where: { slug } })) {
    counter++
    slug = `${await slugify(base)}-${counter}`
  }
  return slug
}

// ── Main seeding function ─────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding EduScore Lebanon – large dataset…\n')

  // ── Terms ──────────────────────────────────────────────────────────────────
  const termDefs = [
    { season: 'FALL',   year: 2023, name: 'Fall 2023',   isActive: false, isCurrent: false },
    { season: 'SPRING', year: 2024, name: 'Spring 2024', isActive: false, isCurrent: false },
    { season: 'SUMMER', year: 2024, name: 'Summer 2024', isActive: false, isCurrent: false },
    { season: 'FALL',   year: 2024, name: 'Fall 2024',   isActive: true,  isCurrent: false },
    { season: 'SPRING', year: 2025, name: 'Spring 2025', isActive: true,  isCurrent: true  },
  ]
  for (const t of termDefs) {
    const existing = await prisma.academicTerm.findFirst({ where: { season: t.season, year: t.year, universityId: null } })
    if (!existing) await prisma.academicTerm.create({ data: t })
  }
  const currentTerm  = await prisma.academicTerm.findFirst({ where: { isCurrent: true } })
  const previousTerm = await prisma.academicTerm.findFirst({ where: { season: 'FALL', year: 2024 } })
  console.log('✅ Academic terms ready')

  // ── Admin user ─────────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: 'admin@eduscore.lb' },
    update: {},
    create: { email: 'admin@eduscore.lb', name: 'EduScore Admin', role: 'ADMIN', emailVerified: new Date() },
  })

  // ── Universities ───────────────────────────────────────────────────────────
  let globalProfOffset = 0
  let reviewUserIndex = 1
  let totalProfs = 0; let totalCourses = 0; let totalSections = 0; let totalReviews = 0

  for (const uniCfg of UNIVERSITIES) {
    const { faculties: facultiesCfg, ...uniFields } = uniCfg

    const uni = await prisma.university.upsert({
      where: { slug: uniFields.slug },
      update: { registrationModel: uniFields.registrationModel },
      create: uniFields,
    })

    // Generate all professor names for this university upfront
    const totalProfCount = facultiesCfg.reduce((s, f) => s + f.departments.reduce((ss, d) => ss + d.professorCount, 0), 0)
    const profNames = generateProfessorNames(totalProfCount, globalProfOffset)
    globalProfOffset += totalProfCount * 7

    let profNameIndex = 0
    // Maps for linking
    const uniProfMap: Map<string, string> = new Map()  // lastName -> profId (for reviews)

    for (const facCfg of facultiesCfg) {
      const { departments: deptsCfg, ...facFields } = facCfg

      const faculty = await prisma.faculty.upsert({
        where: { universityId_slug: { universityId: uni.id, slug: facFields.slug } },
        update: {},
        create: { ...facFields, universityId: uni.id },
      })

      for (const deptCfg of deptsCfg) {
        const dept = await prisma.department.upsert({
          where: { facultyId_slug: { facultyId: faculty.id, slug: deptCfg.slug } },
          update: {},
          create: { name: deptCfg.name, slug: deptCfg.slug, code: deptCfg.code, facultyId: faculty.id },
        })

        // ── Courses ──────────────────────────────────────────────────────────
        const catalog = COURSE_CATALOGS[deptCfg.catalogKey] ?? COURSE_CATALOGS.GEN
        const deptProfs: string[] = []  // professor IDs for this dept

        for (const courseEntry of catalog) {
          const courseSlug = `${courseEntry.code.replace(/\s+/g, '-').toLowerCase()}-${uni.slug}`
          const existing = await prisma.course.findFirst({
            where: { code: courseEntry.code, departmentId: dept.id },
          })
          let courseId: string
          if (existing) {
            courseId = existing.id
          } else {
            const created = await prisma.course.create({
              data: { ...courseEntry, slug: courseSlug, departmentId: dept.id },
            })
            courseId = created.id
            totalCourses++
          }

          // Create sections for current and previous term
          for (const term of [currentTerm, previousTerm]) {
            if (!term) continue
            const slotIdx = (catalog.indexOf(courseEntry) + (term.isCurrent ? 0 : 8)) % TIME_SLOTS.length
            const slot = TIME_SLOTS[slotIdx]
            const existing = await prisma.section.findFirst({
              where: { courseId, termId: term.id, sectionNumber: '1' },
            })
            if (!existing) {
              const section = await prisma.section.create({
                data: { courseId, termId: term.id, sectionNumber: '1', isActive: true, capacity: 35 },
              })
              for (const day of slot.days) {
                await prisma.sectionMeeting.create({
                  data: { sectionId: section.id, day, startTime: slot.start, endTime: slot.end, type: 'LECTURE' },
                })
              }
              totalSections++
            }
          }
        }

        // ── Professors ───────────────────────────────────────────────────────
        for (let pi = 0; pi < deptCfg.professorCount; pi++) {
          const nameData = profNames[profNameIndex++ % profNames.length]
          const fullName = [nameData.title, nameData.firstName, nameData.lastName].join(' ')
          const baseSlug = `${nameData.firstName.toLowerCase().replace(/[^a-z]+/g, '-')}-${nameData.lastName.toLowerCase().replace(/[^a-z]+/g, '-')}-${uni.slug}`

          const existing = await prisma.professor.findFirst({
            where: { firstName: nameData.firstName, lastName: nameData.lastName, departmentId: dept.id },
          })

          let profId: string
          if (existing) {
            profId = existing.id
          } else {
            let slug = baseSlug; let counter = 0
            while (await prisma.professor.findUnique({ where: { slug } })) { counter++; slug = `${baseSlug}-${counter}` }

            const prof = await prisma.professor.create({
              data: { firstName: nameData.firstName, lastName: nameData.lastName, title: nameData.title, fullName, slug, departmentId: dept.id },
            })
            profId = prof.id
            totalProfs++
          }

          deptProfs.push(profId)
          uniProfMap.set(`${nameData.lastName}-${pi}`, profId)

          // Assign professor to courses and sections
          const coursesForProf = catalog.slice(0, Math.min(4, catalog.length))
          for (let ci = 0; ci < coursesForProf.length; ci++) {
            if ((pi + ci) % 2 !== 0) continue // not every prof teaches every course
            const courseEntry = coursesForProf[ci]
            const course = await prisma.course.findFirst({ where: { code: courseEntry.code, departmentId: dept.id } })
            if (!course) continue

            await prisma.professorCourse.upsert({
              where: { professorId_courseId: { professorId: profId, courseId: course.id } },
              update: {},
              create: { professorId: profId, courseId: course.id },
            })

            // Link professor to sections
            for (const term of [currentTerm, previousTerm]) {
              if (!term) continue
              const section = await prisma.section.findFirst({ where: { courseId: course.id, termId: term.id, sectionNumber: '1' } })
              if (!section) continue

              const existSP = await prisma.sectionProfessor.findFirst({ where: { sectionId: section.id, professorId: profId } })
              if (!existSP) {
                await prisma.sectionProfessor.create({
                  data: { sectionId: section.id, professorId: profId, isPrimary: pi === 0 },
                })
              }
            }
          }
        }
      }
    }

    // ── Reviews ───────────────────────────────────────────────────────────────
    // Give each professor between 2 and 6 reviews
    const allUniProfs = await prisma.professor.findMany({
      where: { department: { faculty: { universityId: uni.id } } },
      select: { id: true, fullName: true },
    })

    for (const prof of allUniProfs) {
      const reviewCount = 2 + (prof.id.charCodeAt(0) % 5) // 2-6 reviews
      const profCourses = await prisma.professorCourse.findMany({
        where: { professorId: prof.id },
        include: { course: true },
        take: 3,
      })

      for (let ri = 0; ri < reviewCount; ri++) {
        const seed = ri * 13 + prof.id.charCodeAt(2) * 7 + allUniProfs.indexOf(prof) * 3
        const template = generateReview(seed, prof.fullName.split(' ').pop() ?? prof.fullName, uni.shortName)
        const course = profCourses[ri % Math.max(1, profCourses.length)]?.course

        const reviewUser = await prisma.user.upsert({
          where: { email: `reviewer${reviewUserIndex}@eduscore.lb` },
          update: {},
          create: {
            email: `reviewer${reviewUserIndex}@eduscore.lb`,
            name: `Student ${reviewUserIndex}`,
            role: 'STUDENT',
            emailVerified: new Date(),
          },
        })
        reviewUserIndex++

        const existingReview = await prisma.review.findFirst({
          where: { userId: reviewUser.id, professorId: prof.id },
        })
        if (existingReview) continue

        await prisma.review.create({
          data: {
            userId: reviewUser.id,
            professorId: prof.id,
            courseId: course?.id,
            status: 'APPROVED',
            isAnonymous: true,
            termTaken: ri % 2 === 0 ? 'Spring 2025' : 'Fall 2024',
            ...template,
          },
        })
        totalReviews++
      }
    }

    // ── Recompute professor stats ──────────────────────────────────────────────
    for (const prof of allUniProfs) {
      const reviews = await prisma.review.findMany({
        where: { professorId: prof.id, status: 'APPROVED' },
        select: { overallRating: true, teachingClarity: true, workloadLevel: true, gradingFairness: true, attendanceStrict: true, examDifficulty: true, participation: true, wouldRecommend: true },
      })
      if (!reviews.length) continue
      const avg = (key: keyof typeof reviews[0]) => {
        const vals = reviews.map(r => r[key]).filter((v): v is number => typeof v === 'number')
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      }
      await prisma.professor.update({
        where: { id: prof.id },
        data: {
          overallRating: avg('overallRating'), teachingClarity: avg('teachingClarity'),
          workloadLevel: avg('workloadLevel'), gradingFairness: avg('gradingFairness'),
          attendanceStrict: avg('attendanceStrict'), examDifficulty: avg('examDifficulty'),
          participation: avg('participation'),
          recommendRate: reviews.filter(r => r.wouldRecommend).length / reviews.length * 100,
          reviewCount: reviews.length,
        },
      })
    }

    // ── Recompute course stats ─────────────────────────────────────────────────
    const coursesWithReviews = await prisma.course.findMany({
      where: { department: { faculty: { universityId: uni.id } }, reviews: { some: { status: 'APPROVED' } } },
      select: { id: true },
    })
    for (const { id: courseId } of coursesWithReviews) {
      const reviews = await prisma.review.findMany({
        where: { courseId, status: 'APPROVED' },
        select: { workloadLevel: true, examDifficulty: true, gradingFairness: true },
      })
      const avg = (key: keyof typeof reviews[0]) => {
        const vals = reviews.map(r => r[key]).filter((v): v is number => typeof v === 'number')
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      }
      await prisma.course.update({
        where: { id: courseId },
        data: { avgWorkload: avg('workloadLevel'), avgDifficulty: avg('examDifficulty'), avgGrading: avg('gradingFairness'), reviewCount: reviews.length },
      })
    }

    console.log(`✅ ${uni.shortName}: ${totalProfs - (globalProfOffset > totalProfCount ? 0 : 0)} professors, courses, sections, reviews seeded`)
  }

  console.log(`\n📊 Final counts:`)
  console.log(`   Universities: ${await prisma.university.count()}`)
  console.log(`   Professors:   ${await prisma.professor.count()}`)
  console.log(`   Courses:      ${await prisma.course.count()}`)
  console.log(`   Sections:     ${await prisma.section.count()}`)
  console.log(`   Reviews:      ${await prisma.review.count()}`)
  console.log(`   Users:        ${await prisma.user.count()}`)
  console.log('\n🎉 Database seeded successfully!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
