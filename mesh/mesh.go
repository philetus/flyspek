// triangle mesh interface

package mesh
import (
    "github.com/go-gl/mathgl/mgl32" // vector & matrix lib
)

type Number int
type Flavor int
const (
    FILLED Flavor = iota
    CONVEX
    CONCAVE
)
type Nd [3]int

type Triangle struct { // triangle defined by 3 indices into vertex list
    Vnd Nd // indices into vertex list
    Flvr Flavor // defaults to filled
    Cnd Nd // indices into color list, by default first color in list
}

type Mesh struct {
    Nmbr Number
    Vrts []mgl32.Vec2
    Clrs []mgl32.Vec4
    Trngls []Triangle
}

func (self Triangle) Vertices(m Mesh) []float32 {
    f := make([]float32, 0, 6)
    for _, n := range self.Vnd {
        for _, s := range m.Vrts[n] {
            f = append(f, float32(s))
        }
    }
    return f
}

func (self Triangle) Colors(m Mesh) []float32 {
    f := make([]float32, 0, 12)
    for _, n := range self.Cnd {
        for _, s := range m.Clrs[n] {
            f = append(f, float32(s))
        }
    }
    return f
}