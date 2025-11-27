import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Terminal, Settings, HelpCircle, User, LogOut } from 'lucide-react'

export function ComponentShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            shadcn/ui Component Showcase
          </h1>
          <p className="text-muted-foreground">
            Oceanic Calm Theme Integration Test
          </p>
        </div>

        <Separator />

        {/* Buttons Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="default">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="destructive">Destructive Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="link">Link Button</Button>
          </div>
          <div className="flex gap-4">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">
              <Terminal className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <Separator />

        {/* Badges Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Badges</h2>
          <div className="flex flex-wrap gap-4">
            <Badge>Default Badge</Badge>
            <Badge variant="secondary">Secondary Badge</Badge>
            <Badge variant="destructive">Destructive Badge</Badge>
            <Badge variant="outline">Outline Badge</Badge>
          </div>
        </section>

        <Separator />

        {/* Tabs Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Tabs</h2>
          <Tabs defaultValue="terminal" className="w-full">
            <TabsList>
              <TabsTrigger value="terminal">Terminal</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="terminal" className="space-y-4">
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-card-foreground">Terminal content goes here</p>
              </div>
            </TabsContent>
            <TabsContent value="files">
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-card-foreground">File browser content</p>
              </div>
            </TabsContent>
            <TabsContent value="settings">
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-card-foreground">Settings panel</p>
              </div>
            </TabsContent>
          </Tabs>
        </section>

        <Separator />

        {/* Dialog Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Dialog</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Open Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Session</DialogTitle>
                <DialogDescription>
                  Configure a new terminal session with custom settings.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-foreground">Dialog content goes here</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setDialogOpen(false)}>Create Session</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>

        <Separator />

        {/* Dropdown Menu Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Dropdown Menu</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <User className="mr-2 h-4 w-4" />
                User Menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <HelpCircle className="mr-2 h-4 w-4" />
                Help
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </section>

        <Separator />

        {/* Tooltip Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Tooltip</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>This is a helpful tooltip</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </section>

        <Separator />

        {/* Scroll Area Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Scroll Area</h2>
          <ScrollArea className="h-48 w-full rounded-md border border-border bg-card p-4">
            <div className="space-y-2">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="text-card-foreground">
                  Item {i + 1}: This is a scrollable item in the scroll area
                </div>
              ))}
            </div>
          </ScrollArea>
        </section>

        <Separator />

        {/* Resizable Panels Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Resizable Panels</h2>
          <ResizablePanelGroup direction="horizontal" className="min-h-[200px] rounded-md border">
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center bg-card p-6">
                <span className="text-card-foreground">Panel 1 (Resizable)</span>
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center bg-card p-6">
                <span className="text-card-foreground">Panel 2 (Resizable)</span>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </section>

        <Separator />

        {/* Color Palette Reference */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Oceanic Calm Color Palette</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <div className="h-16 rounded-md border border-border" style={{ backgroundColor: '#88C0D0' }} />
              <p className="text-sm text-foreground">Primary</p>
              <p className="text-xs text-muted-foreground">#88C0D0</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-md border border-border" style={{ backgroundColor: '#3B4252' }} />
              <p className="text-sm text-foreground">Secondary</p>
              <p className="text-xs text-muted-foreground">#3B4252</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-md border border-border" style={{ backgroundColor: '#BF616A' }} />
              <p className="text-sm text-foreground">Destructive</p>
              <p className="text-xs text-muted-foreground">#BF616A</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-md border border-border" style={{ backgroundColor: '#4C566A' }} />
              <p className="text-sm text-foreground">Border</p>
              <p className="text-xs text-muted-foreground">#4C566A</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
