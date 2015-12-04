package pane

import (
    //"fmt"
    "github.com/gopherjs/gopherjs/js"
    //"github.com/go-gl/mathgl/mgl32" // vector & matrix lib
    "github.com/philetus/flyspek/mesh"
)

const (
    VERTEX_STRIDE = 2
    TEXTURE_STRIDE = 2
    CURVE_STRIDE = 1
    COLOR_STRIDE = 4
)

var (
    bezier_texture = []float32{ // texture to generate quadratic bezier curve
        1.0,  1.0,
        0.5,  0.0,
        0.0,  0.0,
    }
    fill_texture = []float32{ // texture to generate filled triangle
        0.0, 1.0,
        0.0, 1.0,
        0.0, 1.0,
    }
    fill_curve = []float32{ 1.0, 1.0, 1.0 }
    convex_curve = []float32{ 1.0, 1.0, 1.0 }
    concave_curve = []float32{ -1.0, -1.0, -1.0 }
)

type glbuff struct {
    nmbr mesh.Number // id number of buffered mesh
    lngth int // number of triangles in mesh
    vrts *js.Object
    txtrs *js.Object
    crvs *js.Object
    clrs *js.Object
}

func (self *pane) BuffMesh(msh mesh.Mesh) {
    var bff *glbuff; var ok bool
    if bff, ok = self.meshdeks[msh.Nmbr]; !ok {
        bff = &glbuff{}

        // prepare gl buffers to hold mesh data
        bff.vrts = self.gl.CreateBuffer()
        bff.txtrs = self.gl.CreateBuffer()
        bff.crvs = self.gl.CreateBuffer()
        bff.clrs = self.gl.CreateBuffer()

        // set id number
        bff.nmbr = msh.Nmbr
    }

    // write triangle data into flat float32 slices
    bff.lngth = len(msh.Trngls) * 3 // length is # of triangle vertices
    vrts := make([]float32, 0, bff.lngth * VERTEX_STRIDE)
    txtrs := make([]float32, 0, bff.lngth * TEXTURE_STRIDE)
    crvs := make([]float32, 0, bff.lngth * CURVE_STRIDE)
    clrs := make([]float32, 0, bff.lngth * COLOR_STRIDE)

    for _, trngl := range msh.Trngls {

        // append vertices
        vrts = append(vrts, trngl.Vertices(msh)...)

        // append textures and curves according to triangle flavor
        switch trngl.Flvr {

        case mesh.FILLED:
            txtrs = append(txtrs, fill_texture...)
            crvs = append(crvs, fill_curve...)

        case mesh.CONVEX:
            txtrs = append(txtrs, bezier_texture...)
            crvs = append(crvs, convex_curve...)

        case mesh.CONCAVE:
            txtrs = append(txtrs, bezier_texture...)
            crvs = append(crvs, concave_curve...)
        }

        // append colors
        clrs = append(clrs, trngl.Colors(msh)...)
    }

    // buffer data to gl
    //self.Log(fmt.Sprintf("vertices %v", vrts))
    self.gl.BindBuffer(self.gl.ARRAY_BUFFER, bff.vrts)
    self.gl.BufferData(self.gl.ARRAY_BUFFER, vrts, self.gl.STATIC_DRAW)
    //self.Log(fmt.Sprintf("textures %v", txtrs))
    self.gl.BindBuffer(self.gl.ARRAY_BUFFER, bff.txtrs)
    self.gl.BufferData(self.gl.ARRAY_BUFFER, txtrs, self.gl.STATIC_DRAW)
    //self.Log(fmt.Sprintf("curves %v", crvs))
    self.gl.BindBuffer(self.gl.ARRAY_BUFFER, bff.crvs)
    self.gl.BufferData(self.gl.ARRAY_BUFFER, crvs, self.gl.STATIC_DRAW)
    //self.Log(fmt.Sprintf("colors %v", clrs))
    self.gl.BindBuffer(self.gl.ARRAY_BUFFER, bff.clrs)
    self.gl.BufferData(self.gl.ARRAY_BUFFER, clrs, self.gl.STATIC_DRAW)

    self.meshdeks[bff.nmbr] = bff
}

func (self *pane) DeleteMesh(msh mesh.Mesh) { // TODO: free gl buffers?
    delete(self.meshdeks, msh.Nmbr)
}

func (self *pane) drawBuff(bff *glbuff) {

    // set attribute pointers
    self.gl.BindBuffer(self.gl.ARRAY_BUFFER, bff.vrts)
    self.gl.VertexAttribPointer(
        self.aVertex, VERTEX_STRIDE, self.gl.FLOAT, false, 0, 0)
    self.gl.BindBuffer(self.gl.ARRAY_BUFFER, bff.txtrs)
    self.gl.VertexAttribPointer(
        self.aBezier, TEXTURE_STRIDE, self.gl.FLOAT, false, 0, 0)
    self.gl.BindBuffer(self.gl.ARRAY_BUFFER, bff.crvs)
    self.gl.VertexAttribPointer(
        self.aCurve, CURVE_STRIDE, self.gl.FLOAT, false, 0, 0)
    self.gl.BindBuffer(self.gl.ARRAY_BUFFER, bff.clrs)
    self.gl.VertexAttribPointer(
        self.aColor, COLOR_STRIDE, self.gl.FLOAT, false, 0, 0)

    // draw triangles from buffers
    self.gl.DrawArrays(self.gl.TRIANGLES, 0, bff.lngth)
}

func (self *pane) DropBuff(nmbr mesh.Number) {
    delete(self.meshdeks, nmbr)
}