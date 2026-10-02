import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function FAQ({ items }: { items: string[][] }) {
  return <Accordion type="single" collapsible className="w-full [&_[data-slot=accordion-content][data-state=closed]]:hidden">{items.map(([question, answer], index) => <AccordionItem key={question} value={String(index)}>
    <AccordionTrigger className="min-h-16 py-5 text-left text-base leading-relaxed hover:no-underline hover:text-link">{question}</AccordionTrigger>
    <AccordionContent forceMount className="max-w-3xl pb-6 text-base leading-relaxed text-muted-foreground">{answer}</AccordionContent>
  </AccordionItem>)}</Accordion>;
}
