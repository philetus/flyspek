package pane

import (
    //"fmt"
    "github.com/gopherjs/gopherjs/js"
    "github.com/go-gl/mathgl/mgl32" // vector & matrix lib
)

type EventFlavor int
const (
    DOWN EventFlavor = iota
    UP
    MOVE
)

type PointerEvent struct {
    Flvr EventFlavor // UP | DOWN | MOVE
    Pos mgl32.Vec2 // position vector in mesh coord space
}

func (self *pane) pix2Vec(evnt *js.Object) mgl32.Vec2 {
    v := mgl32.Vec3{ // generate vector from current pixel coords
        float32(evnt.Get("clientX").Float()),
        float32(evnt.Get("clientY").Float()),
        1.0, // apply translations from transform matrix
    }
    v = self.untransform.Mul3x1(v) // apply pan & zoom untransform matrix

    return v.Vec2() // return vec2
}

func (self *pane) loop() {

    // set callbacks
    self.window.Call(
        "addEventListener", "resize", 
        func() {
            select { // nonblocking attempt to signal resize channel
            case self.resizePipe <- true:
            default:
            }
        },
    )
    self.document.Call(
        "addEventListener", "mousedown", 
        func(evnt *js.Object) {
            pe := PointerEvent{Flvr: DOWN, Pos: self.pix2Vec(evnt)}
            select { // nonblocking attempt to add event to pointer channel
            case self.PointerPipe <- pe:
            default:
            }
        },
    )
    self.document.Call(
        "addEventListener", "mouseup", 
        func(evnt *js.Object) {
            pe := PointerEvent{Flvr: UP, Pos: self.pix2Vec(evnt)}
            select { // nonblocking attempt to add event to pointer channel
            case self.PointerPipe <- pe:
            default:
            }
        },
    )
    self.document.Call(
        "addEventListener", "mousemove", 
        func(evnt *js.Object) {
            pe := PointerEvent{Flvr: MOVE, Pos: self.pix2Vec(evnt)}
            select { // nonblocking attempt to add event to pointer channel
            case self.PointerPipe <- pe:
            default:
            }
        },
    )
    // set initial resolution
    self.SetResolution()

    for { // loop and listen to input channels
        select {

        case <- self.resizePipe:
            self.SetResolution()
            self.draw()

        case mshdff := <- self.meshPipe: // buffer new meshes then redraw
            for _, msh := range mshdff {
                if msh.Trngls == nil { // delete meshes with no triangles
                    self.DeleteMesh(msh)
                } else {
                    self.BuffMesh(msh)
                }
            }
            self.draw()

        case zm := <- self.zoomPipe:
            self.zoom = zm[:2]
            self.setTransform()

        case pan := <- self.panPipe:
            self.pan = pan[:2]
            self.setTransform()
        }
    }
}
