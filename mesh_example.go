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
                {64, 144}, // {-1.0,  0.0}, // a 0
                {144, 256}, // { 0.0,  1.0}, // b 1
                {256, 144}, // { 1.0,  0.0}, // c 2
                {64, 288}, // {-1.0,  1.2}, // d 3
                {256, 196}, // { 1.0,  0.8}, // e 4
            },
        Clrs: []mgl32.Vec4{
                {1.0, 0.0, 0.0, 0.8},
            },
        Trngls: []mesh2.Triangle{
                { Vnd: mesh2.Nd{0, 1, 2}, Flvr: mesh2.CONCAVE },
                { Vnd: mesh2.Nd{1, 3, 0}, Flvr: mesh2.CONVEX },
                { Vnd: mesh2.Nd{2, 4, 1} },
            },
    }

    // push mesh to gl buffer
    pn.BuffMesh(msh)

    // draw something
    pn.Draw()
}
