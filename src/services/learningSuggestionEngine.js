import { logger } from '../utils/logger.js';

export class LearningSuggestionEngine {
  static get ResourceDatabase() {
    return {
      'typescript': {
        topic: 'TypeScript Basics & Casing typings',
        resourceUrl: 'https://www.typescriptlang.org/docs/'
      },
      'python': {
        topic: 'Python Programming Language Basics',
        resourceUrl: 'https://docs.python.org/3/tutorial/'
      },
      'c++': {
        topic: 'C++ Object Oriented Programming',
        resourceUrl: 'https://learncpp.com/'
      },
      'c#': {
        topic: 'C# fundamentals and .NET Framework',
        resourceUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/'
      },
      'go': {
        topic: 'Go programming and concurrency models',
        resourceUrl: 'https://go.dev/doc/tutorial/getting-started'
      },
      'rust': {
        topic: 'Rust ownership rules and systems coding',
        resourceUrl: 'https://doc.rust-lang.org/book/'
      },
      'docker': {
        topic: 'Containerization using Docker',
        resourceUrl: 'https://docs.docker.com/get-started/'
      },
      'kubernetes': {
        topic: 'Container orchestration with Kubernetes',
        resourceUrl: 'https://kubernetes.io/docs/tutorials/'
      },
      'aws': {
        topic: 'AWS Cloud Services and deployments',
        resourceUrl: 'https://aws.amazon.com/getting-started/'
      },
      'azure': {
        topic: 'Microsoft Azure cloud development',
        resourceUrl: 'https://learn.microsoft.com/en-us/azure/'
      },
      'gcp': {
        topic: 'Google Cloud Platform (GCP) Fundamentals',
        resourceUrl: 'https://cloud.google.com/docs'
      },
      'next.js': {
        topic: 'Full-stack React Framework Next.js',
        resourceUrl: 'https://nextjs.org/docs'
      },
      'nestjs': {
        topic: 'NestJS Framework for building scalable server-side NodeJS apps',
        resourceUrl: 'https://docs.nestjs.com/'
      },
      'mongodb': {
        topic: 'NoSQL document storage using MongoDB',
        resourceUrl: 'https://docs.mongodb.com/'
      },
      'postgresql': {
        topic: 'Relational Database PostgreSQL management',
        resourceUrl: 'https://www.postgresql.org/docs/'
      },
      'redis': {
        topic: 'Caching and Key-Value memory caches with Redis',
        resourceUrl: 'https://redis.io/docs/get-started/'
      },
      'graphql': {
        topic: 'Designing API schemas with GraphQL query structures',
        resourceUrl: 'https://graphql.org/learn/'
      },
      'ci/cd': {
        topic: 'GitHub Actions workflow automation',
        resourceUrl: 'https://docs.github.com/en/actions'
      },
      'machine learning': {
        topic: 'Introductory Machine Learning & statistics models',
        resourceUrl: 'https://developers.google.com/machine-learning/crash-course'
      },
      'jest': {
        topic: 'Unit testing Node apps with Jest',
        resourceUrl: 'https://jestjs.io/docs/getting-started'
      },
      'testing': {
        topic: 'Software testing, TDD, and test runners',
        resourceUrl: 'https://martinfowler.com/articles/practical-test-pyramid.html'
      }
    };
  }

  /**
   * Produce suggested learning resources for missing skills.
   * @param {Array<string>} missingSkills List of missing skills
   */
  static getSuggestions(missingSkills) {
    if (!Array.isArray(missingSkills)) return [];

    const suggestions = [];

    for (const skill of missingSkills) {
      const lower = skill.toLowerCase();
      const ref = this.ResourceDatabase[lower];

      if (ref) {
        suggestions.push({
          skill,
          topic: ref.topic,
          resourceUrl: ref.resourceUrl
        });
      } else {
        // Dynamic fallback suggestion if not in predefined map
        suggestions.push({
          skill,
          topic: `Learning documentation and tutorials for ${skill}`,
          resourceUrl: `https://www.google.com/search?q=${encodeURIComponent(skill + ' documentation tutorial')}`
        });
      }
    }

    return suggestions;
  }
}
export default LearningSuggestionEngine;
