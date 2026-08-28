// Your public profile. Replace the placeholders, then add or remove command
// modules in commands/index.js as needed.
export const resumeConfig = {
  site: {
    title: 'Your Name | Interactive Terminal Resume',
    description: 'Explore my experience through an interactive terminal resume.',
    socialDescription: 'A modular, terminal-style portfolio and resume.',
    terminalName: 'Terminal Resume',
    terminalVersion: 'resume-ui 1.0.0',
  },
  header: {
    welcome: 'Welcome!',
    mobileName: 'Your Name',
    tagline: 'Your Role@your-location',
    mobileTagline: 'Your Role · Your Location',
    name: 'YOUR NAME',
    label: 'YOUR SPECIALTY',
    summary: 'Write two concise sentences describing what you do, the problems you solve, and the environments where you have the most impact.',
    focus: 'Current focus: Topic one • Topic two • Topic three',
    links: [
      { label: 'City, Country' },
      { label: 'hello@example.com', href: 'mailto:hello@example.com' },
      { label: 'linkedin.com/in/your-handle', href: 'https://www.linkedin.com' },
      { label: 'example.com', href: 'https://example.com' },
    ],
  },
  quickCommands: ['/experience', '/context', '/skills', '/impact', '/pacman', '/contact'],
  jobs: {
    recent: [
      {
        title: 'Your Current Role',
        company: 'Company',
        dates: '2024 - Present',
        location: 'City or Remote',
        tech: ['Primary skill', 'Second skill', 'Third skill'],
        bullets: [
          'Describe one meaningful outcome and your contribution to it.',
          'Add scale, scope, or measurable evidence when it helps the reader.',
        ],
      },
    ],
    earlier: [],
  },
  context: {
    cells: { software: 8, platform: 6, search: 6, vision: 4, ai: 8, future: 18 },
    loaded: 'Your career context loaded',
    legend: [
      { type: 'ai', label: 'Current specialty', value: 'current' },
      { type: 'search', label: 'Previous specialty', value: 'earlier' },
      { type: 'software', label: 'Software engineering', value: 'foundation' },
    ],
    futureLabel: 'NEXT',
    futureValue: 'chapter loading...',
  },
  skills: [
    { title: 'specialty', items: ['Skill one', 'Skill two', 'Skill three'] },
    { title: 'engineering', items: ['Architecture', 'Delivery', 'Operations'] },
    { title: 'leadership', items: ['Technical direction', 'Collaboration', 'Mentoring'] },
    { title: 'domains', items: ['Industry one', 'Industry two'] },
  ],
  impact: [
    'Describe the strongest outcome you created and who benefited.',
    'Show how you moved a difficult project from idea to production.',
    'Add a leadership or cross-functional outcome.',
  ],
  contact: [
    { kind: 'mail', mark: '✉', label: 'email', value: 'hello@example.com', href: 'mailto:hello@example.com' },
    { kind: 'linkedin', mark: 'in', label: 'linkedin', value: '/in/your-handle', href: 'https://www.linkedin.com' },
    { kind: 'github', mark: 'GH', label: 'github', value: 'github.com/your-handle', href: 'https://github.com' },
    { kind: 'web', mark: '◎', label: 'web', value: 'example.com', href: 'https://example.com' },
    { kind: 'location', mark: '⌖', label: 'location', value: 'City, Country' },
  ],
  ai: {
    systemPrompt: 'You are a concise assistant embedded in an interactive resume. You are not the resume owner. Answer only from the supplied profile context, never invent missing details, and say plainly when the context does not contain an answer.',
    coreContext: 'PRIMARY PROFILE — Replace this paragraph with a concise factual summary of the resume owner and their current work.',
    sections: {
      experience: 'EXPERIENCE — Summarize the roles, responsibilities, and progression that the assistant should know.',
      skills: 'SKILLS — List the strongest technical, product, and leadership capabilities.',
      impact: 'IMPACT — Summarize the strongest outcomes supported by the resume.',
      contact: 'CONTACT — Add only the contact information intended to be public.',
    },
    routes: [
      ['experience', /\b(experience|career|role|job|company|work)\b/i],
      ['skills', /\b(skill|technology|expertise|stack|strength)\b/i],
      ['impact', /\b(impact|outcome|achievement|result|built|delivered)\b/i],
      ['contact', /\b(contact|email|linkedin|github|website|location)\b/i],
    ],
    alwaysInclude: ['experience', 'skills', 'impact'],
  },
};
