package main

import (
    "fmt"
    // "github.com/gopherjs/gopherjs/js"
    "github.com/go-gl/mathgl/mgl32"
    "github.com/philetus/flyspek/mesh"
    "github.com/philetus/flyspek/fig"
    "github.com/philetus/flyspek/pane"
)

func main() {

    pn := pane.New()

    bfly := makeBfly()

    msh := bfly.Klap() // collapse fig into mesh

    // add meshes to pane and draw them
    pn.Draw(msh)

    // loop and handle pointer events
    for {
        select {
        case pntrEvnt := <- pn.PointerPipe:
            switch pntrEvnt.Flvr {

            case pane.DOWN:
                pointerDown = true
                fmt.Printf("pointer down at %v\n", pntrEvnt.Pos)

            case pane.UP:
                pointerDown = false
                fmt.Printf("pointer up at %v\n", pntrEvnt.Pos)

            case pane.MOVE:
                if pointerDown {
                }
            }
        }
    }
}

func makeBfly() {

}