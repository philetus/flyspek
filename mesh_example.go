package main

import (
    // "github.com/gopherjs/gopherjs/js"
    "github.com/go-gl/mathgl/mgl32"
    "github.com/philetus/flyspek/mesh"
    "github.com/philetus/flyspek/pane"
)

func main() {

    pn := pane.New()

    // build mesh
    msh := mesh.Mesh{
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

    m2 := mesh.Mesh{
        Nmbr: 2,
        Vrts: []mgl32.Vec2{
            {100, 100},
            {100, 200},
            {200, 200},
        },
        Clrs: []mgl32.Vec4{
            {1.0, 0.0, 0.0, 0.7},
        },
        Trngls: []mesh.Triangle{
            {Vnd: mesh.Nd{0, 1, 2}},
        },
    }

    pn.SetZoom(2.0, 2.0)
    pn.SetPan(0.0, 50.0)
    pn.SetResolution()

    // add meshes to pane and draw them
    pn.Draw(msh, m2)
}
