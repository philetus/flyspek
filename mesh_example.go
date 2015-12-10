package main

import (
    "fmt"
    // "github.com/gopherjs/gopherjs/js"
    "github.com/go-gl/mathgl/mgl32"
    "github.com/philetus/flyspek/mesh"
    "github.com/philetus/flyspek/pane"
)

func main() {

    pn := pane.New()

    var pointerDown bool

    // build mesh
    msh := mesh.Mesh{
        Nmbr: 1,
        Dpth: 1.0,
        Vrts: []mgl32.Vec2{
                {50, 50},   // {-1.0,  -0.5}, // a 0
                {150, 150}, // { 0.0,  0.5}, // b 1
                {250, 50},  // { 1.0,  -0.5}, // c 2
                {50, 170},  // {-1.0,  0.7}, // d 3
                {250, 130}, // { 1.0,  0.3}, // e 4
            },
        Clrs: []mgl32.Vec4{
                {1.0, 0.0, 0.0, 1.0}, // a
                {1.0, 0.0, 1.0, 1.0}, // b
                {0.0, 0.0, 1.0, 1.0}, // c
                {0.0, 1.0, 1.0, 1.0}, // d
                {1.0, 1.0, 0.0, 1.0}, // e
            },
        Trngls: []mesh.Triangle{
                { 
                    Vnd: mesh.Nd{0, 1, 2}, 
                    Flvr: mesh.CONCAVE, 
                    Cnd: mesh.Nd{0, 1, 2}, 
                },
                { 
                    Vnd: mesh.Nd{1, 3, 0}, 
                    Flvr: mesh.CONVEX,
                    Cnd: mesh.Nd{1, 3, 0}, 
                },
                { 
                    Vnd: mesh.Nd{2, 4, 1}, 
                    Cnd: mesh.Nd{2, 4, 1},
                },
            },
    }

    m2 := makeTriangle(2, 0.0, mgl32.Vec2{100, 100})

    pn.SetZoom(2.0, 2.0)
    pn.SetPan(0.0, 50.0)

    // add meshes to pane and draw them
    pn.Draw(msh, m2)

    // loop and handle pointer events
    for {
        select {
        case pntrEvnt := <- pn.PointerPipe:
            switch pntrEvnt.Flvr {

            case pane.DOWN:
                pointerDown = true
                fmt.Printf("pointer down at %v\n", pntrEvnt.Pos)
                msh.Vrts[0] = pntrEvnt.Pos
                pn.Draw(msh)

            case pane.UP:
                fmt.Printf("pointer up at %v\n", pntrEvnt.Pos)
                pointerDown = false

            case pane.MOVE:
                if pointerDown {
                    msh.Vrts[0] = pntrEvnt.Pos
                    pn.Draw(msh)
                }
            }
        }
    }
}

func makeTriangle(n mesh.Number, d float32, o mgl32.Vec2) mesh.Mesh {
    return mesh.Mesh{
        Nmbr: n,
        Dpth: d,
        Vrts: []mgl32.Vec2{
            o.Add(mgl32.Vec2{0, 0}),
            o.Add(mgl32.Vec2{0, 100}),
            o.Add(mgl32.Vec2{100, 100}),
        },
        Clrs: []mgl32.Vec4{
            {0.7, 1.0, 0.0, 0.7},
        },
        Trngls: []mesh.Triangle{
            {Vnd: mesh.Nd{0, 1, 2}},
        },
    }
}