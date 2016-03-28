package fig

type Flavor string // flavor of mark
type Slot string // slot in deks
type Handle string // name of mark in zib book, allows mark to be ark
type Path string // composite handle path
type Plex int // number of times to repeat mark
type Turtle float32

type Spek struct {
    deks map[Handle]Mark
}

func (self Spek) Mesh() (mesh.Mesh, bool) {

    // create new fig to hold collapsed tree
    kfig := Fig{}

    // clone mark tree
    if kfig.root, ok := self.root.Clone(); !ok {
        return nil, false
    }

    // collapse ark references
    kfig.klaps(kfig.root)
}

func (self Spek) Fetch(pth Path) (Mark, bool) {
    hndls := pth.Handles()
    if len(hndls) < 1 { return nil, false }

    // get initial zib
    var zb Zib, ok bool
    if zb, ok = self.deks[hndls[0]]; !ok { return nil, false }
    hndls = hndls[1:] // pop hndl

    // find next zib while this isnt last handle
    for len(hndls) > 1 {
        if zb, ok = zb.book[hndls[0]]; !ok { return nil, false }
        hndls = hndls[1:] // pop hndl
    }
    
}

type Mark struct {
    flavor Flavor
    handle Handle
    ark Path
    plex Plex
    deks map[Slot]Mark
    num []Mark
    turt Turtle
}
{
    Flavor() Flavor
    SetFlavor(Flavor)
    Handle() Handle
    SetHandle(Handle)
    Ark() Path
    SetArk() Path
    Deks() map[Slot]Mark
    SetDeks(Slot, Mark)
    DeDeks(Slot)
    Ray() []Mark
    PushRay(Mark)
}

type Zib struct {
    handle Handle
    ark Path
    warp Nyun
    swag Nyun
    nyuns []Nyun
    ziblets []Zib
    book map[Handle]Mark // for zibs to track handled marks
    klapsd bool
}
func (self Zib) Clone() (Zib, bool) {
    kzb := Zib{ 
        handle: self.handle, 
        ark: self.ark,
        warp: self.warp.Clone(),
        swag: self.swag.Clone(),
    }
    for _, nyn := range self.nyuns {
        if knyn, ok := nyn.Clone(); ok {
            kzb.nyuns = append(kzb.nyuns, knyn)
        } else {
            return kzb, false
        }
    }
    for _, zblt := range self.ziblets {
        if kzblt, ok := zb.Clone(); ok {
            kzb.ziblets = append(kzb.ziblets, kzblt)
        }
    }
}

type Nyun struct {
    flavor Flavor
    handle Handle
    ark Path
    deks map[Slot]Nyun
    ray []Nyun
    tooth []float32 // for klapsd values
    klapsd bool
}

