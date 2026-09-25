/** Fixed outreach templates. Variables in {{braces}}. Sales agent may edit only the {{personal_hook}} line. */
export const OUTREACH_TEMPLATES = {
  first_touch: {
    subject: "Rare-earth-free magnet patents: {{count}} new families this week",
    body: `Hi {{first_name}},

{{personal_hook}}

I run RareFree Intelligence, a weekly patent-intelligence briefing focused only on rare-earth-free and rare-earth-lean permanent magnets (iron nitride, Mn–Bi, Mn–Al, advanced ferrites, L10 FeNi) and RE-free motor designs. Each issue deduplicates international families, covers CN/JP/KR filings in English, and adds a plain-language note on what each family means competitively. Every number is pulled from USPTO, EPO and Google Patents records, never inferred.

Would a sample issue be useful for your team? I can send this week's edition, no strings attached.

Best regards,
{{sender_name}}
{{company_name}} · {{postal_address}}
If you'd rather not hear from us: {{unsubscribe_url}}`,
  },
  follow_up: {
    subject: "Re: rare-earth-free magnet patents — sample issue",
    body: `Hi {{first_name}},

Following up once. This week's briefing covered {{count}} new families, including {{highlight}}. Happy to send it over, or to point you to the right colleague if IP intelligence sits elsewhere at {{company}}.

{{sender_name}}
{{company_name}} · {{postal_address}}
Opt out any time: {{unsubscribe_url}}`,
  },
} as const;

export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}
