package pane

import (
    //"fmt"
    "github.com/gopherjs/gopherjs/js"
    "github.com/gopherjs/webgl"
    "github.com/go-gl/mathgl/mgl32" // vector & matrix lib
    "github.com/philetus/flyspek/mesh"
)

type pane struct { // pane type hidden, call pane.New() to create pane
    console *js.Object // browser console to log to

    window, document, canvas *js.Object
    gl *webgl.Context
    width, height int
    zoom, pan []float32
    transform, untransform mgl32.Mat3

    shader *js.Object  // gl.shader
    uTransform *js.Object // uniform shader variables
    aVertex, aBezier, aCurve, aColor int // varying shader variables

    meshdeks map[mesh.Number]*glbuff

    resizePipe chan bool
    meshPipe chan []mesh.Mesh
    zoomPipe, panPipe chan []float32

    PointerPipe chan PointerEvent
    //KeyPipe chan KeyEvent
}

func New() *pane {
    self := new(pane) // allocate new pane struct
    self.meshdeks = make(map[mesh.Number]*glbuff) // allocate mesh buffer map
    self.zoom = []float32{1.0, 1.0} // zoom defaults to 1.0
    self.pan = []float32{0.0, 0.0}

    // connect console
    self.console = js.Global.Get("console")
    self.Log("creating new pane")

    // create canvas and append to document
    self.window = js.Global.Get("window")
    self.document = js.Global.Get("document")
    self.canvas = self.document.Call("createElement", "canvas")
    self.document.Get("body").Call("appendChild", self.canvas)

    // load gl context
    attrs := webgl.DefaultAttributes()
    attrs.Alpha = false
    gl, err := webgl.NewContext(self.canvas, attrs)
    if err != nil {
        self.Log("error: "+err.Error())
        return nil
    }
    self.gl = gl

    // init shaders
    self.initShaders()

    // set blend function for when alpha blending is enabled
    self.gl.BlendFuncSeparate( 
        self.gl.SRC_ALPHA, self.gl.ONE_MINUS_SRC_ALPHA, 
        self.gl.ZERO, self.gl.ONE)
    self.gl.Enable(self.gl.BLEND)

    // init channels
    self.resizePipe = make(chan bool, 1) // only need to know if >= 1 request
    self.meshPipe = make(chan []mesh.Mesh)
    self.zoomPipe = make(chan []float32)
    self.panPipe = make(chan []float32)
    self.PointerPipe = make(chan PointerEvent, 256)

    // start event loop as goroutine
    go self.loop()

    return self
}

func (self *pane) Log(msg string) {
    self.console.Call("log", msg)
}

func (self *pane) SetZoom(x, y float32) {
    self.zoomPipe <- []float32{float32(x), float32(y)}
}

func (self *pane) SetPan(x, y float32) {
    self.panPipe <- []float32{float32(x), float32(y)}
}

func (self *pane) SetResolution() {
    self.width = self.canvas.Get("clientWidth").Int()
    self.height = self.canvas.Get("clientHeight").Int()

    if (self.canvas.Get("width").Int() != self.width) || 
            (self.canvas.Get("height").Int() != self.height) {
        self.canvas.Set("width", self.width)
        self.canvas.Set("height", self.height)
    }
    self.gl.Viewport(0, 0, self.width, self.height)

    // regenerate transform matrix based on new size and push to gl
    self.setTransform()
}

func (self *pane) draw() {
    self.gl.ClearColor(0.0, 1.0, 1.0, 1.0) // cyanish
    self.gl.Clear(self.gl.COLOR_BUFFER_BIT | self.gl.DEPTH_BUFFER_BIT)

    for _, bff := range self.buffsByDepth() {
        self.drawBuff(bff)
    }
}

func (self *pane) Draw(mshdff ...mesh.Mesh) {
    self.meshPipe <- mshdff // send mesh diff down mesh pipe to trigger redraw
}

func (self *pane) setTransform() {

    // generate transform matrix to convert to (zoomed & panned) pixel space
    m := mgl32.Translate2D(-1.0, -1.0) // move origin to corner
    zm := mgl32.Scale2D(
        self.zoom[0] * 2.0 / float32(self.width), 
        self.zoom[1] * 2.0 / float32(self.height))
    pm := mgl32.Translate2D(self.pan[0], self.pan[1])
    m = m.Mul3(zm)
    self.transform = m.Mul3(pm)

    // generate untransform from pixel space to unzoomed & unpanned mesh space
    upm := mgl32.Translate2D(-self.pan[0], -self.pan[1])
    uzm := mgl32.Scale2D(1.0 / self.zoom[0], 1.0 / self.zoom[1])
    self.untransform = upm.Mul3(uzm)
    
    t := []float32{}
    for _, s := range self.transform {
        t = append(t, float32(s))
    }

    self.gl.UniformMatrix3fv(self.uTransform, false, t)
}
