package main

import (
    // "github.com/gopherjs/gopherjs/js"
    "github.com/go-gl/mathgl/mgl32"
    "github.com/philetus/flyspek/mesh2"
    "github.com/philetus/flyspek/paan"
)

func main() {

    pn := paan.New()

    // build mesh
    msh := mesh2.Mesh{
        Nmbr: 1,
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
        Trngls: []mesh2.Triangle{
                { 
                    Vnd: mesh2.Nd{0, 1, 2}, 
                    Flvr: mesh2.CONCAVE, 
                    Cnd: mesh2.Nd{0, 1, 2}, 
                },
                { 
                    Vnd: mesh2.Nd{1, 3, 0}, 
                    Flvr: mesh2.CONVEX,
                    Cnd: mesh2.Nd{1, 3, 0}, 
                },
                { 
                    Vnd: mesh2.Nd{2, 4, 1}, 
                    Cnd: mesh2.Nd{2, 4, 1},
                },
            },
    }

    pn.SetZoom(2.0, 2.0)
    pn.SetPan(0.0, 50.0)

    // push mesh to gl buffer
    pn.BuffMesh(msh)

    // draw something
    pn.Draw()
}
