import React, { useState } from 'react';
import { Download, Info } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from '@/components/ui/navigation-menu';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { WallpaperCard, type WallpaperCardData } from '@/components/Gallery';
import OwnerContact from '@/components/OwnerContact';
import CommentFeed from '@/components/CommentFeed';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="kit-section"><h2>{title}</h2>{children}</section>;
}

const palette = [
  ['Background', '--background', '#141414'], ['Card', '--card', '#1C1C1C'], ['Secondary', '--secondary', '#252525'],
  ['Foreground', '--foreground', '#E8E8E8'], ['Muted text', '--muted-foreground', '#ADADAD'],
  ['Accent', '--accent', '#303030'], ['Input', '--input', '#858585'], ['Destructive', '--destructive', '#FF738D'],
  ['Grid', '--pixel-grid', '#383838'], ['Primary hover', '--primary-hover', '#6357FF'], ['Primary active', '--primary-active', '#5549EB'], ['Primary', '--primary', '#5B4FFF'], ['Text link', '--link', '#E8E8E8'], ['Field focus', '--ring', '#5B4FFF'],
] as const;

export default function UiKit({ item }: { item: WallpaperCardData }) {
  const [saved, setSaved] = useState(false);
  const [reported, setReported] = useState<string[]>([]);
  return <div className="kit-grid">
    <Section title="Palette"><div className="grid grid-cols-2 gap-4">{palette.map(([label, token, hex]) => <div key={label}><div className="kit-swatch" style={{ backgroundColor: `var(${token})` }} /><p className="mt-2 text-sm">{label}<span className="block text-muted-foreground">{hex}</span></p></div>)}</div></Section>
    <Section title="Typography"><h3 className="hero-title">A screen worth keeping.</h3><p className="mt-6 text-base leading-relaxed text-muted-foreground">Onest carries compact headings. Manrope keeps labels and body text clear. System monospace gives indices and metadata a technical accent. Body text stays at 16 px, and controls keep at least 44 px of touch space.</p><p className="mt-4 text-sm text-muted-foreground">Panel 24 px · Prominent surface 32 px · Media 24 px · Input 12 px</p></Section>
    <Section title="Liquid glass"><Card className="glass-surface"><CardHeader><CardTitle>Compact action surface</CardTitle><CardDescription>Neutral glass keeps the logo accent for the primary action.</CardDescription></CardHeader><CardContent><p>Reading surfaces stay opaque. Reduced transparency uses an opaque fill.</p></CardContent><CardFooter><Button asChild><a href={item.href}>View wallpaper</a></Button></CardFooter></Card></Section>
    <Section title="Buttons"><div className="flex flex-wrap gap-3">{(['default', 'secondary', 'outline', 'ghost', 'link', 'destructive'] as const).map((variant) => <Button key={variant} variant={variant}>{variant}</Button>)}<Button disabled>Disabled</Button><Button disabled aria-busy="true">Saving…</Button><Button><Download data-icon="inline-start" />Download PNG</Button><Button size="icon" aria-label="Download example"><Download /></Button></div><p className="mt-4 text-sm text-muted-foreground">Tab through controls to inspect focus. Press to inspect tactile feedback.</p></Section>
    <Section title="Fields, input and textarea"><form onSubmit={(event) => { event.preventDefault(); setSaved(true); }}><FieldGroup>
      <Field><FieldLabel htmlFor="kit-title">Wallpaper title</FieldLabel><Input id="kit-title" name="title" defaultValue="Violet Horizon" required autoComplete="off" /><FieldDescription>A complete, editable field.</FieldDescription></Field>
      <Field data-invalid><FieldLabel htmlFor="kit-invalid">Invalid example</FieldLabel><Input id="kit-invalid" name="invalid-example" aria-invalid="true" aria-describedby="kit-error" defaultValue="" /><FieldError id="kit-error">Enter a title before publishing.</FieldError></Field>
      <Field data-disabled><FieldLabel htmlFor="kit-disabled">Disabled example</FieldLabel><Input id="kit-disabled" disabled defaultValue="Contours of Silence" /></Field>
      <Field><FieldLabel htmlFor="kit-note">Description</FieldLabel><Textarea id="kit-note" name="description" autoComplete="off" placeholder="Describe the wallpaper" /></Field>
      <Button type="submit">Save example</Button><p role="status" className="min-h-6 text-sm text-link">{saved ? 'Example saved locally.' : ''}</p>
    </FieldGroup></form></Section>
    <Section title="Select, radio group, label and switch"><FieldGroup>
      <Field><FieldLabel htmlFor="kit-select">Collection</FieldLabel><Select defaultValue="contours"><SelectTrigger id="kit-select" className="min-h-12 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="contours">Contours of Silence</SelectItem><SelectItem value="woven">Woven Spectrum</SelectItem></SelectGroup></SelectContent></Select></Field>
      <Field><FieldLabel id="kit-format-label">Wallpaper format</FieldLabel><RadioGroup defaultValue="desktop" aria-labelledby="kit-format-label" className="flex flex-wrap gap-4"><Label htmlFor="kit-desktop"><RadioGroupItem id="kit-desktop" value="desktop" />Desktop</Label><Label htmlFor="kit-mobile"><RadioGroupItem id="kit-mobile" value="mobile" />Mobile</Label></RadioGroup></Field>
      <Field orientation="horizontal"><Label htmlFor="kit-switch">Enable example setting</Label><Switch id="kit-switch" /></Field>
      <Field orientation="horizontal"><Label htmlFor="kit-switch-disabled">Disabled setting</Label><Switch id="kit-switch-disabled" disabled /></Field>
    </FieldGroup></Section>
    <Section title="Tabs and accordion"><Tabs defaultValue="desktop"><TabsList className="grid h-auto w-full grid-cols-2"><TabsTrigger value="desktop" className="min-h-11">Desktop</TabsTrigger><TabsTrigger value="mobile" className="min-h-11">Mobile</TabsTrigger></TabsList><TabsContent value="desktop" className="py-4 text-muted-foreground">Landscape wallpaper preview.</TabsContent><TabsContent value="mobile" className="py-4 text-muted-foreground">Portrait wallpaper preview.</TabsContent></Tabs><Accordion type="single" collapsible><AccordionItem value="download"><AccordionTrigger>How do downloads work?</AccordionTrigger><AccordionContent>Original PNG downloads use a native link or form. They remain available without JavaScript.</AccordionContent></AccordionItem></Accordion></Section>
    <Section title="Dialog and sheet"><div className="flex flex-wrap gap-3">
      <Dialog><DialogTrigger asChild><Button variant="outline">Open dialog</Button></DialogTrigger><DialogContent className="glass-surface"><DialogHeader><DialogTitle>Wallpaper details</DialogTitle><DialogDescription>Contours of Silence. Original PNG for personal use.</DialogDescription></DialogHeader></DialogContent></Dialog>
      <Sheet><SheetTrigger asChild><Button variant="outline">Open sheet</Button></SheetTrigger><SheetContent><SheetHeader><SheetTitle>Collection navigation</SheetTitle><SheetDescription>Choose a collection.</SheetDescription></SheetHeader><a href="/collections/contours-of-silence/" className="m-4 min-h-11 rounded-md px-4 py-3 text-link">Contours of Silence</a></SheetContent></Sheet>
    </div></Section>
    <Section title="Navigation menu and breadcrumbs"><NavigationMenu aria-label="Example navigation"><NavigationMenuList><NavigationMenuItem><NavigationMenuLink asChild className="min-h-11"><a href="/collections/">Collections</a></NavigationMenuLink></NavigationMenuItem><NavigationMenuItem><NavigationMenuLink asChild className="min-h-11"><a href="/search/">Search</a></NavigationMenuLink></NavigationMenuItem></NavigationMenuList></NavigationMenu><div className="h-6" aria-hidden="true" /><Breadcrumb aria-label="Example breadcrumbs"><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="/">Home</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>UI kit</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb></Section>
    <Section title="Badges and alerts"><div className="mb-6 flex flex-wrap gap-2"><Badge>Primary</Badge><Badge variant="secondary">Desktop</Badge><Badge variant="outline">Personal use</Badge><Badge variant="destructive">Unavailable</Badge></div><Alert><Info aria-hidden="true" /><AlertTitle>Preview available</AlertTitle><AlertDescription>Download the original PNG from the wallpaper page.</AlertDescription></Alert><Alert variant="destructive" className="mt-4"><AlertTitle>Example error</AlertTitle><AlertDescription>Could not load the preview. Try again.</AlertDescription></Alert></Section>
    <Section title="Cards and gallery"><WallpaperCard item={item} /><Card className="mt-6 bg-secondary"><CardHeader><CardTitle>Download panel</CardTitle><CardDescription>Original PNG for personal use.</CardDescription></CardHeader><CardContent><p className="text-sm text-muted-foreground">Controls share the same button and field variants as the rest of the site.</p></CardContent><CardFooter><Button asChild><a href={item.href}>Open wallpaper</a></Button></CardFooter></Card></Section>
    <Section title="Loading and empty states"><div role="status" aria-label="Loading preview" className="space-y-3"><Skeleton className="aspect-video w-full rounded-xl" /><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-1/2" /></div><div className="h-6" aria-hidden="true" /><p className="text-muted-foreground">No matches yet. Try another word or filter.</p><Button variant="outline" className="mt-4">Reset filters</Button></Section>
    <Section title="Contact card"><OwnerContact locale="en" /></Section>
    <Section title="Comment feed"><CommentFeed locale="en" ownUid="kit-own" busy={false} reported={reported} onAction={(item) => setReported((current) => [...current, item.id])} comments={[{ id: 'kit-comment', uid: 'kit-guest', text: 'A demonstration comment for the component catalog.', createdAt: Date.UTC(2026, 9, 13, 12) }]} /></Section>
    <Section title="Usage"><pre className="whitespace-pre-wrap break-words rounded-md bg-secondary p-4 text-sm leading-relaxed">{`import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

<Button variant="secondary">View wallpaper</Button>
<Field>
  <FieldLabel htmlFor="title">Title</FieldLabel>
  <Input id="title" />
</Field>`}</pre><p className="mt-4 text-sm text-muted-foreground">Use existing primitives and semantic tokens. See DESIGN.md for composition and responsive rules.</p></Section>
  </div>;
}
