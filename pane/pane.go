package pane

import (
    //"fmt"
    "github.com/gopherjs/gopherjs/js"
    "github.com/gopherjs/webgl"
    "github.com/go-gl/mathgl/mgl32" // vector & matrix lib
    "github.com/philetus/flyspek/mesh"
)

const vertexShaderSource = `
    attribute vec2 a_vertex;
    attribute vec2 a_bezier;
    attribute float a_curve;
    attribute vec4 a_color;

    uniform mat3 u_transform; // local coordinate transform

    varying vec2 v_bezier;
    varying float v_curve;
    varying vec4 v_color;

    void main(void) {       
        vec3 transformed = u_transform * vec3(a_vertex, 1.0);
        gl_Position = vec4(transformed * vec3(1.0, -1.0, 0.0), 1.0);
        v_bezier = a_bezier;
        v_curve = a_curve;
        v_color = a_color;
    }
`
const fragShaderSource = `
    #extension GL_OES_standard_derivatives : enable

    #ifdef GL_ES
    precision highp float;
    #endif

    varying vec2 v_bezier;
    varying float v_curve;
    varying vec4 v_color;

    void main(void) {
        vec2 px = dFdx(v_bezier);
        vec2 py = dFdy(v_bezier);
        float fx = 2.0 * v_bezier.x * px.x - px.y;
        float fy = 2.0 * v_bezier.y * py.x - py.y;
        float sd = v_curve * (v_bezier.x * v_bezier.x - v_bezier.y) / sqrt(fx * fx + fy * fy);
        float alpha = clamp((0.5 - sd), 0.0, v_color.w);
        gl_FragColor = vec4(v_color.x, v_color.y, v_color.z, alpha);
    }
`

//type signal interface { 
    // resize(), zoom(float, float), pan(float, float), draw, push(mesh)
    // pointerdown(float,float), 
    //   pointerup(float, float), 
    //   pointermove(float, float),
    //   keydown(int),
    //   keyup(int)
//}

type pane struct { // pane type hidden, call pane.New() to create pane
    console *js.Object // browser console to log to

    window, document, canvas *js.Object
    gl *webgl.Context
    width, height int
    zoom, pan []float32
    transform mgl32.Mat3

    shader *js.Object  // gl.shader
    uTransform *js.Object // uniform shader variables
    aVertex, aBezier, aCurve, aColor int // varying shader variables

    meshdeks map[mesh.Number]*glbuff

    resizePipe chan bool
    meshPipe chan []mesh.Mesh
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

    // start event loop as goroutine
    go self.loop()

    return self
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

    // set initial resolution
    self.SetResolution()

    for { // loop and listen to input channels
        select {

        case <- self.resizePipe:
            self.SetResolution()
            self.draw()

        case meshdiff := <- self.meshPipe: // buffer new meshes then redraw
            for _, msh := range meshdiff {
                if msh.Trngls == nil { // delete meshes with no triangles
                    self.DeleteMesh(msh)
                } else {
                    self.BuffMesh(msh)
                }
            }
            self.draw()
        }
    }
}

func (self *pane) initShaders() {

    // enable gl flags
    self.gl.GetExtension("OES_standard_derivatives")

    // init shader
    self.shader = self.gl.CreateProgram()
    //self.Log(vertexShaderSource)
    //self.Log(fragShaderSource)
    vertexShader := self.getShader(self.gl.VERTEX_SHADER, vertexShaderSource)
    fragShader := self.getShader(self.gl.FRAGMENT_SHADER, fragShaderSource)
    self.gl.AttachShader(self.shader, vertexShader)
    self.gl.AttachShader(self.shader, fragShader)
    self.gl.LinkProgram(self.shader)
    if !self.gl.GetProgramParameterb(self.shader, self.gl.LINK_STATUS) {
        self.Log("couldnt init shaders :(")
    }
    self.gl.UseProgram(self.shader)

    // get gl shader variables
    self.aVertex = self.gl.GetAttribLocation(self.shader, "a_vertex")
    self.gl.EnableVertexAttribArray(self.aVertex)
    self.aBezier = self.gl.GetAttribLocation(self.shader, "a_bezier")
    self.gl.EnableVertexAttribArray(self.aBezier)
    self.aCurve = self.gl.GetAttribLocation(self.shader, "a_curve")
    self.gl.EnableVertexAttribArray(self.aCurve)
    self.aColor = self.gl.GetAttribLocation(self.shader, "a_color")
    self.gl.EnableVertexAttribArray(self.aColor)

    self.uTransform = self.gl.GetUniformLocation(self.shader, "u_transform")
}

func (self *pane) Log(msg string) {
    self.console.Call("log", msg)
}

func (self *pane) SetZoom(x, y float32) {
    self.zoom = []float32{float32(x), float32(y)}
}

func (self *pane) SetPan(x, y float32) {
    self.pan = []float32{float32(x), float32(y)}
}

func (self *pane) getShader(typ int, src string) (shader *js.Object) {
    shader = self.gl.CreateShader(typ)
    self.gl.ShaderSource(shader, src)
    self.gl.CompileShader(shader)
    
    if !self.gl.GetShaderParameter(shader, self.gl.COMPILE_STATUS).Bool() {
        self.Log(self.gl.GetShaderInfoLog(shader))
        return nil
    }
    return shader
}

func (self *pane) SetResolution() {
    self.width = self.canvas.Get("clientWidth").Int()
    self.height = self.canvas.Get("clientHeight").Int()

    if (self.canvas.Get("width").Int() != self.width) || 
            (self.canvas.Get("height").Int() != self.height) {
        self.canvas.Set("width", self.width)
        self.canvas.Set("height", self.height)
    }
    self.gl.Viewport(0, 0, self.width, self.height);
}

func (self *pane) draw() {
    self.gl.ClearColor(0.0, 1.0, 1.0, 1.0) // cyanish
    self.gl.Clear(self.gl.COLOR_BUFFER_BIT | self.gl.DEPTH_BUFFER_BIT)

    // set up transform matrix
    transform := self.Transform()
    //self.Log(fmt.Sprint(transform))
    self.gl.UniformMatrix3fv(self.uTransform, false, transform);

    for _, bff := range self.meshdeks {
        self.drawBuff(bff)
    }
}

func (self *pane) Draw(mshdff ...mesh.Mesh) {
    self.meshPipe <- mshdff // send mesh diff down mesh pipe to trigger redraw
}

func (self *pane) Transform() []float32 {
    m := mgl32.Translate2D(-1.0, -1.0) // move origin to corner
    zm := mgl32.Scale2D(
        self.zoom[0] * 2.0 / float32(self.width), 
        self.zoom[1] * 2.0 / float32(self.height))
    pm := mgl32.Translate2D(self.pan[0], self.pan[1])
    m = m.Mul3(zm)
    m = m.Mul3(pm)
    
    t := []float32{}
    for _, s := range m {
        t = append(t, float32(s))
    }
    return t
}
