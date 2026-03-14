import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eduscore.lb'

  const [professors, courses, universities] = await Promise.all([
    prisma.professor.findMany({
      where: { isActive: true, isMerged: false },
      select: { slug: true, updatedAt: true },
    }),
    prisma.course.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.university.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
  ])

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/professors`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/courses`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/universities`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/schedule-builder`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/guidelines`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ]

  const professorPages: MetadataRoute.Sitemap = professors.map(p => ({
    url: `${baseUrl}/professors/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const coursePages: MetadataRoute.Sitemap = courses.map(c => ({
    url: `${baseUrl}/courses/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  const universityPages: MetadataRoute.Sitemap = universities.map(u => ({
    url: `${baseUrl}/universities/${u.slug}`,
    lastModified: u.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [...staticPages, ...universityPages, ...professorPages, ...coursePages]
}
