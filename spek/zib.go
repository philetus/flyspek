// sup i heard you like to spek 2d forms
package fig

type Fig struct {
    root Zib
}

type Flavor int
const (
    ZIB Flavor = iota
    VOLTWARP
    SKALWARP
    LATWARP
    MIRWARP
    ROTWARP
    PANEL
    SWAG
    RGBA
    BOUND
    REBOUND
    GUIDE
    DELTA
    QUANT
)

type Slot int
const (
    WARP Slot = iota
    SURF // swag
    DEPTH
    WEIGHT
    STROKE
    FILL
    EXTENT
    POS
    BEND
)

type Handle string
type Path string // ark path - handles joined with '.'
func (self Path) Append(hndl Handle) Path {
    return self + Path(".") + Path(hndl)
}

type Mark interface {
    Flavor() Flavor
    Handle() Handle
    SetHandle(Handle)
    Ark() Path
    SetArk(Path)
    Deks() map[Slot]Mark
    SetDeks(map[Slot]Mark)
    Ray() []Mark
    SetRay([]Mark)
    Tooth() (float32, bool)
    SetTooth(float32, bool)
    Nyuns() map[Handle]Mark // list of child marks
    Klap(Path) klapsMark // collapsed version of node
}

type Zib struct {
    handle Handle
    ark Path
    warp Warp
    marks []Mark
    nyuns []Zib
}

type Warp struct {
    flavor Flavor
    handle Handle
    ark Path
    volt []Warp
    delta Delta
}

type Panel struct {
    handle Handle
    ark Path
    surf Swag
    extents Bound
    gaps []Bound
}

type Swag struct {
    handle Handle
    ark Path
    depth Quant
    weight Quant
    stroke Rgba
    fill Rgba
}

type Rgba struct {
    handle Handle
    ark Path
    r Quant
    g Quant
    b Quant
    a Quant
}

type Edge interface {
    Guides() []Guide
}

type Bound struct {
    flavor Flavor
    handle Handle
    ark Path
    guides []Edge
}

type Guide struct {
    handle Handle
    ark Path
    pos Delta
    bend Delta
}

type Delta struct {
    handle Handle
    ark Path
    x Quant
    y Quant
}

type Quant struct {
    handle Handle
    ark Path
    val float32
}