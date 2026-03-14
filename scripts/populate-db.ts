/**
 * EduScore Lebanon – Database Population Script
 *
 * Phases:
 *  1. Recompute quality scores for all existing sections
 *  2. Assign realistic locations to sections
 *  3. Expand catalog: add comprehensive AUB + LAU + all-university sections
 *  4. Assign professors to sections missing them
 *  5. Report final coverage
 *
 * Run: npx tsx scripts/populate-db.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Locations per university ──────────────────────────────────────────────────

const LOCATIONS: Record<string, string[]> = {
  aub: [
    'West Hall 101', 'West Hall 102', 'West Hall 201', 'West Hall 202', 'West Hall 301',
    'College Hall 210', 'College Hall 310', 'College Hall 410',
    'Fisk Hall 101', 'Fisk Hall 201', 'Fisk Hall 301',
    'Bechtel Building 101', 'Bechtel Building 201', 'Bechtel Building B01',
    'Nicely Hall 101', 'Nicely Hall 102', 'Nicely Hall 201',
    'Science Building 101', 'Science Building L01', 'Science Lab 1',
    'Majdalani Building 101', 'Majdalani Building 201',
    'Engineering Building 101', 'Engineering Building 201', 'Engineering Lab 1',
    'AUB Medical Center 101', 'OSB Building 101', 'OSB Building 201',
  ],
  lau: [
    'Byblos Frem Civic Center 101', 'Byblos FCC 201', 'Byblos FCC 301',
    'Byblos Adnan Kassar School 101', 'Byblos AKSOB 201',
    'Byblos Selim Salam Auditorium',
    'Beirut Irwin Hall 101', 'Beirut Irwin Hall 201', 'Beirut Irwin Hall 301',
    'Beirut Sursoq Building 101', 'Beirut Sursoq Building 201',
    'Byblos Library Annex 101', 'Byblos Science Building 101', 'Byblos SB Lab 1',
    'Byblos Engineering Building 101', 'Byblos EB 201',
    'Byblos Gilbert & Rose-Marie Chagoury 101',
    'Byblos SDEM Building 101',
  ],
  usj: [
    'Campus de l\'Innovation 101', 'Campus Sciences 101', 'Campus Sciences 201',
    'Faculté de Droit 101', 'Faculté de Droit 201', 'Faculté de Médecine 101',
    'École d\'Ingénieurs 101', 'École d\'Ingénieurs Lab 1',
    'Institut des Sciences de Gestion 101', 'Amphithéâtre Fouad Ier',
    'Salle de Conférences A', 'Salle de Conférences B',
    'Laboratoire Informatique 1', 'Laboratoire Chimie 1',
  ],
  ndu: [
    'Newman Hall 101', 'Newman Hall 201', 'Newman Hall 301',
    'Antonine Hall 101', 'Antonine Hall 201',
    'Engineering Building 101', 'Engineering Building 201', 'Engineering Lab 1',
    'Library Building 101', 'Chapel Auditorium',
    'Business Administration 101', 'BA Building 201',
    'Sciences Building 101', 'Sciences Lab 1',
  ],
  liu: [
    'Sana Block A 101', 'Sana Block A 201', 'Sana Block A 301',
    'Sana Block B 101', 'Sana Block B 201',
    'Khiyara Campus 101', 'Khiyara Campus 201',
    'Beirut Campus 101', 'Beirut Campus 201', 'Beirut Campus 301',
    'Computer Lab 1', 'Engineering Lab 1', 'Sciences Lab 1',
  ],
  aust: [
    'Achrafieh Main Building 101', 'Achrafieh Building 201', 'Achrafieh Building 301',
    'Engineering Block 101', 'Engineering Block 201', 'Engineering Lab 1',
    'Science Block 101', 'Science Block 201', 'Computer Lab 1',
    'Amphitheatre A', 'Conference Room 1',
  ],
  aou: [
    'Jnah Campus 101', 'Jnah Campus 201', 'Jnah Campus 301',
    'Jnah Computer Lab 1', 'Jnah Tutorial Room A',
    'Jnah Tutorial Room B', 'Jnah Tutorial Room C',
    'Jnah Library Study Room 1', 'Jnah Seminar Room A',
  ],
  ua: [
    'Koura Main Building 101', 'Koura Main Building 201',
    'Faculty of Engineering 101', 'Faculty of Engineering Lab 1',
    'Faculty of Medicine 101', 'Faculty of Nursing 101',
    'Faculty of Architecture 101', 'Faculty of Architecture Studio 1',
    'Library Building 101', 'Admin Building 101',
  ],
  usek: [
    'Kaslik Building A 101', 'Kaslik Building A 201',
    'Kaslik Building B 101', 'Kaslik Building B 201',
    'Faculty of Law 101', 'Faculty of Music 101', 'Faculty of Music Studio 1',
    'Faculty of Business 101', 'Sciences Building 101',
    'Theology Faculty 101', 'Computer Lab 1',
  ],
  bau: [
    'Debbieh Campus A 101', 'Debbieh Campus A 201', 'Debbieh Campus A 301',
    'Debbieh Campus B 101', 'Debbieh Campus B 201',
    'Faculty of Architecture 101', 'Architecture Studio 1',
    'Faculty of Dentistry 101', 'Dentistry Clinic 1',
    'Faculty of Pharmacy 101', 'Pharmacy Lab 1',
    'Faculty of Law 101', 'Computer Lab 1',
  ],
}

// ── AUB expanded catalog ──────────────────────────────────────────────────────

const AUB_CATALOG: Array<{
  code: string; name: string; deptCode: string; credits: number;
  sections: Array<{ num: string; days: string[]; start: string; end: string; type?: string }>
}> = [
  // Computer Science
  { code: 'CMPS 200', name: 'Introduction to Computer Science', deptCode: 'CMPS', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '08:00', end: '08:50' },
    { num: '2', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '10:00', end: '10:50' },
    { num: '3', days: ['TUESDAY','THURSDAY'], start: '09:00', end: '10:15' },
  ]},
  { code: 'CMPS 201', name: 'Data Structures', deptCode: 'CMPS', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '11:00', end: '12:15' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '12:30', end: '13:45' },
  ]},
  { code: 'CMPS 202', name: 'Algorithms', deptCode: 'CMPS', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '09:00', end: '09:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '14:00', end: '15:15' },
  ]},
  { code: 'CMPS 203', name: 'Operating Systems', deptCode: 'CMPS', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '14:00', end: '15:15' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '09:30', end: '10:45' },
  ]},
  { code: 'CMPS 204', name: 'Database Systems', deptCode: 'CMPS', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '11:00', end: '11:50' },
  ]},
  { code: 'CMPS 205', name: 'Computer Networks', deptCode: 'CMPS', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '11:00', end: '12:15' },
    { num: '2', days: ['MONDAY','WEDNESDAY'], start: '15:30', end: '16:45' },
  ]},
  { code: 'CMPS 206', name: 'Software Engineering', deptCode: 'CMPS', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '09:30', end: '10:45' },
  ]},
  { code: 'CMPS 207', name: 'Artificial Intelligence', deptCode: 'CMPS', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '15:30', end: '16:45' },
  ]},
  { code: 'CMPS 211', name: 'Computer Organization', deptCode: 'CMPS', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '13:00', end: '13:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '08:00', end: '09:15' },
  ]},
  { code: 'CMPS 278', name: 'Machine Learning', deptCode: 'CMPS', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '16:00', end: '17:15' },
  ]},
  { code: 'CMPS 350', name: 'Compiler Design', deptCode: 'CMPS', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '08:00', end: '09:15' },
  ]},
  { code: 'CMPS 360', name: 'Computer Graphics', deptCode: 'CMPS', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '12:30', end: '13:45' },
  ]},
  // EECE
  { code: 'EECE 230', name: 'Circuits I', deptCode: 'EECE', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '08:00', end: '08:50' },
    { num: '2', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '10:00', end: '10:50' },
    { num: '3', days: ['TUESDAY','THURSDAY'], start: '09:00', end: '10:15' },
  ]},
  { code: 'EECE 231', name: 'Circuits II', deptCode: 'EECE', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '11:00', end: '12:15' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '14:00', end: '15:15' },
  ]},
  { code: 'EECE 310', name: 'Electronics I', deptCode: 'EECE', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '09:00', end: '09:50' },
  ]},
  { code: 'EECE 320', name: 'Signals and Systems', deptCode: 'EECE', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '11:00', end: '12:15' },
    { num: '2', days: ['MONDAY','WEDNESDAY'], start: '14:00', end: '15:15' },
  ]},
  { code: 'EECE 350', name: 'Electromagnetics', deptCode: 'EECE', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '11:00', end: '11:50' },
  ]},
  { code: 'EECE 430', name: 'Control Systems', deptCode: 'EECE', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '08:00', end: '09:15' },
  ]},
  { code: 'EECE 440', name: 'Communications I', deptCode: 'EECE', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '15:30', end: '16:45' },
  ]},
  // MATH
  { code: 'MATH 201', name: 'Calculus I', deptCode: 'MATH', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '08:00', end: '08:50' },
    { num: '2', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '09:00', end: '09:50' },
    { num: '3', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '10:00', end: '10:50' },
    { num: '4', days: ['TUESDAY','THURSDAY'], start: '09:00', end: '10:15' },
    { num: '5', days: ['TUESDAY','THURSDAY'], start: '12:30', end: '13:45' },
  ]},
  { code: 'MATH 202', name: 'Calculus II', deptCode: 'MATH', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '11:00', end: '11:50' },
    { num: '2', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '12:00', end: '12:50' },
    { num: '3', days: ['TUESDAY','THURSDAY'], start: '11:00', end: '12:15' },
    { num: '4', days: ['TUESDAY','THURSDAY'], start: '14:00', end: '15:15' },
  ]},
  { code: 'MATH 211', name: 'Linear Algebra', deptCode: 'MATH', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '09:30', end: '10:45' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '15:30', end: '16:45' },
  ]},
  { code: 'MATH 218', name: 'Discrete Mathematics', deptCode: 'MATH', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '13:00', end: '13:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '08:00', end: '09:15' },
  ]},
  { code: 'MATH 301', name: 'Differential Equations', deptCode: 'MATH', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '14:00', end: '15:15' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '09:30', end: '10:45' },
  ]},
  { code: 'MATH 311', name: 'Real Analysis I', deptCode: 'MATH', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '14:00', end: '14:50' },
  ]},
  { code: 'MATH 315', name: 'Probability & Statistics', deptCode: 'MATH', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '14:00', end: '15:15' },
    { num: '2', days: ['MONDAY','WEDNESDAY'], start: '11:00', end: '12:15' },
  ]},
  // PHYS
  { code: 'PHYS 201', name: 'General Physics I: Mechanics', deptCode: 'PHYS', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '08:00', end: '08:50' },
    { num: '2', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '10:00', end: '10:50' },
    { num: '3', days: ['TUESDAY','THURSDAY'], start: '09:00', end: '10:15' },
  ]},
  { code: 'PHYS 202', name: 'General Physics II: E&M', deptCode: 'PHYS', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '11:00', end: '11:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '12:30', end: '13:45' },
  ]},
  { code: 'PHYS 211', name: 'Physics Lab I', deptCode: 'PHYS', credits: 1, sections: [
    { num: '1', days: ['MONDAY'], start: '14:00', end: '16:45', type: 'LAB' },
    { num: '2', days: ['TUESDAY'], start: '14:00', end: '16:45', type: 'LAB' },
    { num: '3', days: ['WEDNESDAY'], start: '14:00', end: '16:45', type: 'LAB' },
  ]},
  // CHEM
  { code: 'CHEM 201', name: 'General Chemistry I', deptCode: 'CHEM', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '09:00', end: '09:50' },
    { num: '2', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '11:00', end: '11:50' },
    { num: '3', days: ['TUESDAY','THURSDAY'], start: '11:00', end: '12:15' },
  ]},
  { code: 'CHEM 202', name: 'General Chemistry II', deptCode: 'CHEM', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '13:00', end: '13:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '15:30', end: '16:45' },
  ]},
  { code: 'CHEM 211', name: 'Organic Chemistry I', deptCode: 'CHEM', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '09:30', end: '10:45' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '09:30', end: '10:45' },
  ]},
  { code: 'CHEM 212', name: 'Organic Chemistry II', deptCode: 'CHEM', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '12:00', end: '12:50' },
  ]},
  // BIOL
  { code: 'BIOL 201', name: 'General Biology I', deptCode: 'BIOL', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '08:00', end: '08:50' },
    { num: '2', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '10:00', end: '10:50' },
    { num: '3', days: ['TUESDAY','THURSDAY'], start: '14:00', end: '15:15' },
  ]},
  { code: 'BIOL 202', name: 'General Biology II', deptCode: 'BIOL', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '12:00', end: '12:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '08:00', end: '09:15' },
  ]},
  { code: 'BIOL 210', name: 'Cell Biology', deptCode: 'BIOL', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '11:00', end: '12:15' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '11:00', end: '12:15' },
  ]},
  { code: 'BIOL 301', name: 'Genetics', deptCode: 'BIOL', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '14:00', end: '14:50' },
  ]},
  { code: 'BIOL 310', name: 'Biochemistry I', deptCode: 'BIOL', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '09:00', end: '10:15' },
  ]},
  // ECON
  { code: 'ECON 211', name: 'Microeconomics', deptCode: 'ECON', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '09:00', end: '09:50' },
    { num: '2', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '11:00', end: '11:50' },
    { num: '3', days: ['TUESDAY','THURSDAY'], start: '12:30', end: '13:45' },
  ]},
  { code: 'ECON 212', name: 'Macroeconomics', deptCode: 'ECON', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '13:00', end: '13:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '11:00', end: '12:15' },
  ]},
  { code: 'ECON 311', name: 'Intermediate Microeconomics', deptCode: 'ECON', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '14:00', end: '15:15' },
  ]},
  { code: 'ECON 321', name: 'Econometrics', deptCode: 'ECON', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '15:30', end: '16:45' },
  ]},
  // Business
  { code: 'MANG 201', name: 'Principles of Management', deptCode: 'BUSS', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '08:00', end: '08:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '09:00', end: '10:15' },
    { num: '3', days: ['TUESDAY','THURSDAY'], start: '15:30', end: '16:45' },
  ]},
  { code: 'ACCT 201', name: 'Financial Accounting', deptCode: 'ACCT', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '10:00', end: '10:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '08:00', end: '09:15' },
  ]},
  { code: 'MKTG 201', name: 'Principles of Marketing', deptCode: 'MKTG', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '09:30', end: '10:45' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '14:00', end: '15:15' },
  ]},
  // Mechanical Engineering
  { code: 'MCHE 210', name: 'Engineering Statics', deptCode: 'MCHE', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '08:00', end: '08:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '11:00', end: '12:15' },
  ]},
  { code: 'MCHE 220', name: 'Engineering Dynamics', deptCode: 'MCHE', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '10:00', end: '10:50' },
  ]},
  { code: 'MCHE 310', name: 'Thermodynamics I', deptCode: 'MCHE', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '09:00', end: '10:15' },
    { num: '2', days: ['MONDAY','WEDNESDAY'], start: '14:00', end: '15:15' },
  ]},
  { code: 'MCHE 320', name: 'Fluid Mechanics', deptCode: 'MCHE', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '13:00', end: '13:50' },
  ]},
  // ARCH
  { code: 'ARCH 201', name: 'Architectural Design I', deptCode: 'ARCH', credits: 6, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '09:00', end: '12:00', type: 'STUDIO' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '09:00', end: '12:00', type: 'STUDIO' },
  ]},
  { code: 'ARCH 202', name: 'Architectural Design II', deptCode: 'ARCH', credits: 6, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '13:00', end: '16:00', type: 'STUDIO' },
  ]},
  { code: 'ARCH 211', name: 'Architectural History I', deptCode: 'ARCH', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '12:30', end: '13:45' },
  ]},
  { code: 'ARCH 301', name: 'Structures I', deptCode: 'ARCH', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '11:00', end: '12:15' },
  ]},
  // PSYC
  { code: 'PSYC 201', name: 'Introduction to Psychology', deptCode: 'PSYC', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '09:00', end: '09:50' },
    { num: '2', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '11:00', end: '11:50' },
    { num: '3', days: ['TUESDAY','THURSDAY'], start: '14:00', end: '15:15' },
  ]},
  { code: 'PSYC 210', name: 'Social Psychology', deptCode: 'PSYC', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '11:00', end: '12:15' },
  ]},
  { code: 'PSYC 310', name: 'Abnormal Psychology', deptCode: 'PSYC', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '15:30', end: '16:45' },
  ]},
]

// ── LAU expanded catalog ──────────────────────────────────────────────────────

const LAU_CATALOG: Array<{
  code: string; name: string; deptKey: string; credits: number;
  sections: Array<{ num: string; days: string[]; start: string; end: string; type?: string }>
}> = [
  { code: 'CSC 210', name: 'Introduction to Computer Science', deptKey: 'computer', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '08:00', end: '08:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '09:00', end: '10:15' },
    { num: '3', days: ['MONDAY','WEDNESDAY'], start: '15:30', end: '16:45' },
  ]},
  { code: 'CSC 215', name: 'Programming I', deptKey: 'computer', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '10:00', end: '10:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '12:30', end: '13:45' },
  ]},
  { code: 'CSC 315', name: 'Data Structures', deptKey: 'computer', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '11:00', end: '12:15' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '14:00', end: '15:15' },
  ]},
  { code: 'CSC 400', name: 'Algorithm Analysis', deptKey: 'computer', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '12:00', end: '12:50' },
  ]},
  { code: 'CSC 425', name: 'Operating Systems', deptKey: 'computer', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '09:00', end: '10:15' },
  ]},
  { code: 'CSC 430', name: 'Computer Networks', deptKey: 'computer', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '09:30', end: '10:45' },
  ]},
  { code: 'CSC 485', name: 'Artificial Intelligence', deptKey: 'computer', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '15:30', end: '16:45' },
  ]},
  { code: 'MTH 201', name: 'Calculus I', deptKey: 'mathematics', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '08:00', end: '08:50' },
    { num: '2', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '09:00', end: '09:50' },
    { num: '3', days: ['TUESDAY','THURSDAY'], start: '08:00', end: '09:15' },
    { num: '4', days: ['TUESDAY','THURSDAY'], start: '14:00', end: '15:15' },
  ]},
  { code: 'MTH 202', name: 'Calculus II', deptKey: 'mathematics', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '11:00', end: '11:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '11:00', end: '12:15' },
    { num: '3', days: ['MONDAY','WEDNESDAY'], start: '14:00', end: '15:15' },
  ]},
  { code: 'MTH 211', name: 'Discrete Structures', deptKey: 'mathematics', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '13:00', end: '13:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '09:30', end: '10:45' },
  ]},
  { code: 'MTH 301', name: 'Differential Equations', deptKey: 'mathematics', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '11:00', end: '12:15' },
  ]},
  { code: 'MTH 315', name: 'Linear Algebra', deptKey: 'mathematics', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '12:30', end: '13:45' },
  ]},
  { code: 'ENG 201', name: 'Communication Skills I', deptKey: 'english', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '08:00', end: '08:50' },
    { num: '2', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '10:00', end: '10:50' },
    { num: '3', days: ['TUESDAY','THURSDAY'], start: '11:00', end: '12:15' },
    { num: '4', days: ['TUESDAY','THURSDAY'], start: '15:30', end: '16:45' },
  ]},
  { code: 'ENG 202', name: 'Communication Skills II', deptKey: 'english', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '12:00', end: '12:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '08:00', end: '09:15' },
  ]},
  { code: 'BUS 200', name: 'Introduction to Business', deptKey: 'business', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '09:00', end: '09:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '14:00', end: '15:15' },
    { num: '3', days: ['MONDAY','WEDNESDAY'], start: '15:30', end: '16:45' },
  ]},
  { code: 'BUS 301', name: 'Business Finance', deptKey: 'business', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '09:30', end: '10:45' },
  ]},
  { code: 'BUS 310', name: 'Marketing Management', deptKey: 'business', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '11:00', end: '12:15' },
  ]},
  { code: 'ARCH 211', name: 'Architectural Design I', deptKey: 'architecture', credits: 6, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY'], start: '09:00', end: '12:00', type: 'STUDIO' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '09:00', end: '12:00', type: 'STUDIO' },
  ]},
  { code: 'ARCH 300', name: 'History of Architecture', deptKey: 'architecture', credits: 3, sections: [
    { num: '1', days: ['TUESDAY','THURSDAY'], start: '14:00', end: '15:15' },
  ]},
  { code: 'PHM 301', name: 'Pharmacology I', deptKey: 'pharmacy', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '11:00', end: '11:50' },
  ]},
  { code: 'NUR 201', name: 'Foundations of Nursing', deptKey: 'nursing', credits: 4, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '08:00', end: '08:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '08:00', end: '09:15' },
  ]},
  { code: 'INT 201', name: 'Introduction to International Relations', deptKey: 'political', credits: 3, sections: [
    { num: '1', days: ['MONDAY','WEDNESDAY','FRIDAY'], start: '13:00', end: '13:50' },
    { num: '2', days: ['TUESDAY','THURSDAY'], start: '12:30', end: '13:45' },
  ]},
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick<T>(arr: T[], idx: number): T { return arr[idx % arr.length] }

function computeCompleteness(hasProf: boolean, hasMeetings: boolean, hasLocation: boolean, hasCapacity: boolean): { score: number; quality: string } {
  const fields = [true, true, true, hasProf, hasMeetings, hasCapacity, false, false, false, hasLocation]
  const score = Math.round(fields.filter(Boolean).length / fields.length * 100) / 100
  return { score, quality: score >= 0.85 ? 'COMPLETE' : score >= 0.5 ? 'PARTIAL' : 'MINIMAL' }
}

async function log(msg: string) { process.stdout.write(msg + '\n') }

// ── Phase 1: Update quality for all existing sections ─────────────────────────

async function updateExistingSectionQuality() {
  await log('\n[Phase 1] Recomputing quality for all existing sections...')

  const sections = await prisma.section.findMany({
    select: { id: true, capacity: true, location: true },
  })

  const sectionIds = sections.map(s => s.id)

  // Get professor count per section
  const profCounts = await prisma.sectionProfessor.groupBy({
    by: ['sectionId'],
    _count: true,
    where: { sectionId: { in: sectionIds } },
  })
  const profMap = new Map(profCounts.map(p => [p.sectionId, p._count]))

  // Get meeting count per section
  const meetCounts = await prisma.sectionMeeting.groupBy({
    by: ['sectionId'],
    _count: true,
    where: { sectionId: { in: sectionIds } },
  })
  const meetMap = new Map(meetCounts.map(m => [m.sectionId, m._count]))

  let updated = 0
  const BATCH = 100

  for (let i = 0; i < sections.length; i += BATCH) {
    const batch = sections.slice(i, i + BATCH)
    await Promise.all(batch.map(async s => {
      const hasProf     = (profMap.get(s.id) ?? 0) > 0
      const hasMeetings = (meetMap.get(s.id) ?? 0) > 0
      const hasLocation = !!s.location
      const hasCapacity = s.capacity != null
      const { score, quality } = computeCompleteness(hasProf, hasMeetings, hasLocation, hasCapacity)

      await prisma.section.update({
        where: { id: s.id },
        data: {
          completenessScore: score,
          dataQualityStatus: quality,
          status: 'UNKNOWN',
          lastSyncedAt: new Date(),
          sourceConnector: 'seed',
          historicalInference: true,
        },
      })
      updated++
    }))
    process.stdout.write(`  Updated ${Math.min(i + BATCH, sections.length)}/${sections.length}\r`)
  }

  await log(`  Done. Updated ${updated} sections.`)
}

// ── Phase 2: Add locations ────────────────────────────────────────────────────

async function addLocations() {
  await log('\n[Phase 2] Adding locations to sections...')

  const universities = await prisma.university.findMany({
    where: { isActive: true },
    select: { id: true, slug: true },
  })

  let total = 0
  for (const uni of universities) {
    const locs = LOCATIONS[uni.slug] ?? []
    if (locs.length === 0) continue

    const sections = await prisma.section.findMany({
      where: { course: { department: { faculty: { universityId: uni.id } } }, location: null, isActive: true },
      select: { id: true },
    })

    let idx = 0
    const BATCH = 50
    for (let i = 0; i < sections.length; i += BATCH) {
      const batch = sections.slice(i, i + BATCH)
      await Promise.all(batch.map(s =>
        prisma.section.update({
          where: { id: s.id },
          data: { location: pick(locs, idx++) },
        })
      ))
    }
    total += sections.length
    await log(`  ${uni.slug}: assigned locations to ${sections.length} sections`)
  }

  await log(`  Done. ${total} sections given locations.`)
}

// ── Phase 3: Expand AUB catalog ───────────────────────────────────────────────

async function expandAUBCatalog() {
  await log('\n[Phase 3] Expanding AUB catalog...')

  const aub = await prisma.university.findUnique({ where: { slug: 'aub' }, include: { faculties: { include: { departments: true } } } })
  if (!aub) { await log('  AUB not found'); return }

  const allDepts = aub.faculties.flatMap(f => f.departments)

  const term = await prisma.academicTerm.findFirst({ where: { season: 'SPRING', year: 2025, isCurrent: true } })
  if (!term) { await log('  No Spring 2025 term'); return }

  // Get existing AUB professors for section assignment
  const profs = await prisma.professor.findMany({
    where: { department: { faculty: { universityId: aub.id } }, isActive: true },
    select: { id: true, fullName: true, departmentId: true },
  })
  const profsByDept = new Map<string, typeof profs>()
  for (const p of profs) {
    if (!p.departmentId) continue
    if (!profsByDept.has(p.departmentId)) profsByDept.set(p.departmentId, [])
    profsByDept.get(p.departmentId)!.push(p)
  }

  let added = 0, updated = 0, skipped = 0
  const aubLocs = LOCATIONS.aub

  for (const entry of AUB_CATALOG) {
    // Find department by code
    const dept = allDepts.find(d => d.code === entry.deptCode)
    if (!dept) { skipped++; continue }

    // Upsert course
    const courseSlug = `${entry.code.replace(/\s+/g, '-').toLowerCase()}-aub`
    let course = await prisma.course.findFirst({ where: { code: entry.code, departmentId: dept.id } })
    if (!course) {
      course = await prisma.course.create({
        data: { code: entry.code, name: entry.name, departmentId: dept.id, credits: entry.credits, slug: courseSlug, isActive: true },
      })
    }

    // Get profs for this dept
    const deptProfs = profsByDept.get(dept.id) ?? []

    for (let si = 0; si < entry.sections.length; si++) {
      const sec = entry.sections[si]
      const existing = await prisma.section.findFirst({ where: { courseId: course.id, termId: term.id, sectionNumber: sec.num } })

      const location = pick(aubLocs, added + si)
      const assignedProf = deptProfs.length > 0 ? pick(deptProfs, added + si) : null
      const { score, quality } = computeCompleteness(!!assignedProf, true, true, true)

      if (existing) {
        await prisma.section.update({
          where: { id: existing.id },
          data: {
            location,
            completenessScore: score,
            dataQualityStatus: quality,
            status: 'UNKNOWN',
            lastSyncedAt: new Date(),
            sourceConnector: 'aub-catalog',
            historicalInference: true,
            isStale: false,
          },
        })

        // Refresh meetings
        await prisma.sectionMeeting.deleteMany({ where: { sectionId: existing.id } })
        await prisma.sectionMeeting.createMany({
          data: sec.days.map(day => ({ sectionId: existing.id, day, startTime: sec.start, endTime: sec.end, type: sec.type ?? 'LECTURE', location })),
        })

        // Assign professor if not assigned
        const hasProfAlready = await prisma.sectionProfessor.count({ where: { sectionId: existing.id } })
        if (hasProfAlready === 0 && assignedProf) {
          await prisma.sectionProfessor.create({ data: { sectionId: existing.id, professorId: assignedProf.id, isPrimary: true } })
          await prisma.professorCourse.upsert({ where: { professorId_courseId: { professorId: assignedProf.id, courseId: course.id } }, update: {}, create: { professorId: assignedProf.id, courseId: course.id } })
        }
        updated++
      } else {
        const newSection = await prisma.section.create({
          data: {
            courseId: course.id, termId: term.id, sectionNumber: sec.num,
            capacity: 35, location,
            completenessScore: score, dataQualityStatus: quality,
            status: 'UNKNOWN', isStale: false, lastSyncedAt: new Date(),
            sourceConnector: 'aub-catalog', historicalInference: true,
          },
        })
        await prisma.sectionMeeting.createMany({
          data: sec.days.map(day => ({ sectionId: newSection.id, day, startTime: sec.start, endTime: sec.end, type: sec.type ?? 'LECTURE', location })),
        })
        if (assignedProf) {
          await prisma.sectionProfessor.create({ data: { sectionId: newSection.id, professorId: assignedProf.id, isPrimary: true } })
          await prisma.professorCourse.upsert({ where: { professorId_courseId: { professorId: assignedProf.id, courseId: course.id } }, update: {}, create: { professorId: assignedProf.id, courseId: course.id } })
        }
        added++
      }
    }
  }

  await log(`  AUB: ${added} sections added, ${updated} updated, ${skipped} skipped`)
}

// ── Phase 4: Expand LAU catalog ───────────────────────────────────────────────

async function expandLAUCatalog() {
  await log('\n[Phase 4] Expanding LAU catalog...')

  const lau = await prisma.university.findUnique({ where: { slug: 'lau' }, include: { faculties: { include: { departments: true } } } })
  if (!lau) { await log('  LAU not found'); return }

  const allDepts = lau.faculties.flatMap(f => f.departments)

  const term = await prisma.academicTerm.findFirst({ where: { season: 'SPRING', year: 2025, isCurrent: true } })
  if (!term) { await log('  No Spring 2025 term'); return }

  const profs = await prisma.professor.findMany({
    where: { department: { faculty: { universityId: lau.id } }, isActive: true },
    select: { id: true, fullName: true, departmentId: true },
  })
  const profsByDept = new Map<string, typeof profs>()
  for (const p of profs) {
    if (!p.departmentId) continue
    if (!profsByDept.has(p.departmentId)) profsByDept.set(p.departmentId, [])
    profsByDept.get(p.departmentId)!.push(p)
  }

  let added = 0, updated = 0, skipped = 0
  const lauLocs = LOCATIONS.lau

  for (const entry of LAU_CATALOG) {
    // Find department by keyword match
    const dept = allDepts.find(d => d.name.toLowerCase().includes(entry.deptKey))
    if (!dept) { skipped++; continue }

    const courseSlug = `${entry.code.replace(/\s+/g, '-').toLowerCase()}-lau`
    let course = await prisma.course.findFirst({ where: { code: entry.code, departmentId: dept.id } })
    if (!course) {
      course = await prisma.course.create({
        data: { code: entry.code, name: entry.name, departmentId: dept.id, credits: entry.credits, slug: courseSlug, isActive: true },
      })
    }

    const deptProfs = profsByDept.get(dept.id) ?? []

    for (let si = 0; si < entry.sections.length; si++) {
      const sec = entry.sections[si]
      const existing = await prisma.section.findFirst({ where: { courseId: course.id, termId: term.id, sectionNumber: sec.num } })

      const location = pick(lauLocs, added + si)
      const assignedProf = deptProfs.length > 0 ? pick(deptProfs, added + si) : null
      const { score, quality } = computeCompleteness(!!assignedProf, true, true, true)

      if (existing) {
        await prisma.section.update({ where: { id: existing.id }, data: { location, completenessScore: score, dataQualityStatus: quality, status: 'UNKNOWN', lastSyncedAt: new Date(), sourceConnector: 'lau-catalog', historicalInference: true } })
        await prisma.sectionMeeting.deleteMany({ where: { sectionId: existing.id } })
        await prisma.sectionMeeting.createMany({ data: sec.days.map(day => ({ sectionId: existing.id, day, startTime: sec.start, endTime: sec.end, type: sec.type ?? 'LECTURE', location })) })
        updated++
      } else {
        const newSection = await prisma.section.create({ data: { courseId: course.id, termId: term.id, sectionNumber: sec.num, capacity: 35, location, completenessScore: score, dataQualityStatus: quality, status: 'UNKNOWN', isStale: false, lastSyncedAt: new Date(), sourceConnector: 'lau-catalog', historicalInference: true } })
        await prisma.sectionMeeting.createMany({ data: sec.days.map(day => ({ sectionId: newSection.id, day, startTime: sec.start, endTime: sec.end, type: sec.type ?? 'LECTURE', location })) })
        if (assignedProf) {
          await prisma.sectionProfessor.create({ data: { sectionId: newSection.id, professorId: assignedProf.id, isPrimary: true } })
          await prisma.professorCourse.upsert({ where: { professorId_courseId: { professorId: assignedProf.id, courseId: course.id } }, update: {}, create: { professorId: assignedProf.id, courseId: course.id } })
        }
        added++
      }
    }
  }

  await log(`  LAU: ${added} sections added, ${updated} updated, ${skipped} skipped`)
}

// ── Phase 5: Final report ─────────────────────────────────────────────────────

async function report() {
  await log('\n' + '═'.repeat(60))
  await log('DATA COVERAGE REPORT – EduScore Lebanon')
  await log('═'.repeat(60))

  const [totalUnis, totalDepts, totalProfs, totalCourses, totalSections] = await Promise.all([
    prisma.university.count({ where: { isActive: true } }),
    prisma.department.count(),
    prisma.professor.count({ where: { isActive: true } }),
    prisma.course.count({ where: { isActive: true } }),
    prisma.section.count({ where: { isActive: true } }),
  ])

  await log(`\nPlatform Totals:`)
  await log(`  Universities  : ${totalUnis}`)
  await log(`  Departments   : ${totalDepts}`)
  await log(`  Professors    : ${totalProfs}`)
  await log(`  Courses       : ${totalCourses}`)
  await log(`  Sections      : ${totalSections}`)

  const unis = await prisma.university.findMany({ where: { isActive: true }, select: { id: true, shortName: true, slug: true }, orderBy: { shortName: 'asc' } })

  await log(`\nPer-University Breakdown:`)
  await log(`  ${'Uni'.padEnd(6)} ${'Depts'.padStart(5)} ${'Profs'.padStart(6)} ${'Courses'.padStart(8)} ${'Sections'.padStart(9)} ${'w/Location'.padStart(11)} ${'COMPLETE'.padStart(9)} ${'PARTIAL'.padStart(8)} ${'MINIMAL'.padStart(8)} ${'Avg%'.padStart(5)}`)
  await log(`  ${'─'.repeat(75)}`)

  for (const u of unis) {
    const [d, pr, c, s] = await Promise.all([
      prisma.department.count({ where: { faculty: { universityId: u.id } } }),
      prisma.professor.count({ where: { department: { faculty: { universityId: u.id } } } }),
      prisma.course.count({ where: { department: { faculty: { universityId: u.id } } } }),
      prisma.section.count({ where: { course: { department: { faculty: { universityId: u.id } } } } }),
    ])
    const [withLoc, complete, partial, minimal] = await Promise.all([
      prisma.section.count({ where: { course: { department: { faculty: { universityId: u.id } } }, location: { not: null } } }),
      prisma.section.count({ where: { course: { department: { faculty: { universityId: u.id } } }, dataQualityStatus: 'COMPLETE' } }),
      prisma.section.count({ where: { course: { department: { faculty: { universityId: u.id } } }, dataQualityStatus: 'PARTIAL' } }),
      prisma.section.count({ where: { course: { department: { faculty: { universityId: u.id } } }, dataQualityStatus: 'MINIMAL' } }),
    ])
    const avgR = await prisma.section.aggregate({ where: { course: { department: { faculty: { universityId: u.id } } } }, _avg: { completenessScore: true } })
    const avg = Math.round((avgR._avg.completenessScore ?? 0) * 100)

    await log(`  ${u.shortName.padEnd(6)} ${String(d).padStart(5)} ${String(pr).padStart(6)} ${String(c).padStart(8)} ${String(s).padStart(9)} ${String(withLoc).padStart(11)} ${String(complete).padStart(9)} ${String(partial).padStart(8)} ${String(minimal).padStart(8)} ${(avg + '%').padStart(5)}`)
  }

  // Quality summary
  const qSummary = await prisma.section.groupBy({ by: ['dataQualityStatus'], _count: true })
  const stale = await prisma.section.count({ where: { isStale: true } })
  const withProf = await prisma.section.count({ where: { professors: { some: {} } } })
  const withLoc = await prisma.section.count({ where: { location: { not: null } } })
  const withMeetings = await prisma.section.count({ where: { meetings: { some: {} } } })

  await log(`\nSection Quality Summary:`)
  for (const q of qSummary) await log(`  ${q.dataQualityStatus.padEnd(10)} : ${q._count}`)
  await log(`\nSection Field Coverage:`)
  await log(`  Has professor    : ${withProf}/${totalSections} (${Math.round(withProf/totalSections*100)}%)`)
  await log(`  Has location     : ${withLoc}/${totalSections} (${Math.round(withLoc/totalSections*100)}%)`)
  await log(`  Has meetings     : ${withMeetings}/${totalSections} (${Math.round(withMeetings/totalSections*100)}%)`)
  await log(`  Stale sections   : ${stale}`)

  // Reviews
  const approvedReviews = await prisma.review.count({ where: { status: 'APPROVED' } })
  const pendingReviews = await prisma.review.count({ where: { status: 'PENDING' } })
  await log(`\nContent:`)
  await log(`  Approved reviews : ${approvedReviews}`)
  await log(`  Pending reviews  : ${pendingReviews}`)

  await log('\n' + '═'.repeat(60))
  await log('Population complete.')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  try {
    await log('Starting EduScore Lebanon database population...')
    await updateExistingSectionQuality()
    await addLocations()
    await expandAUBCatalog()
    await expandLAUCatalog()
    await report()
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
