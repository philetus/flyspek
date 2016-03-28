package fig

type klapsFig struct {
    book map[Path]klapsMark
}

type klapsZib struct {
    path Path
    ark Path
    warp Path
    nyuns []Path
}

type klapsWarp struct {
    flavor Flavor
    path Path
    ark Path
    delta Path
    mat mgl32.Mat3
}

type klapsPanel struct {
    path Path
    ark Path
    surf Path
    depth float32
    weight float32
    fill [4]float32
    stroke [4]float32
    extent Path // klapsBound
    gaps []Path // klapsBounds
}

type klapsSwag struct {

}

type klapsRgba struct {

}

type klapsBound struct {
    path Path
    guides []Path
}

type klapsGuide struct {
    path Path
    warpstak []Path // list of warps to transform pos thru
    tooth mgl32.Vec2 // unwarped pos value
    pos, bend mgl32.Vec2
}

klapsDelta

type klapsQuant struct {

}

// collapse fig to triangle mesh
func (self *Fig) Klaps() mesh.Mesh {

    // write klapsd mark tree to book
    self.book = make(map[Path]klapsMark)
    pth := Path(self.root.Handle()) // convert root handle to first path
    self.reklaps(pth, self.root)

    // expand clone zibs
}


func (self *Fig) reklaps(pth Path, mrk Mark) {
    km := mrk.Klaps(pth) // collapse mark with current path
    bk[pth] = km // add klapsmark to book at current path

    for hndl, nmrk := range mrk.Nyuns() {
        npth := pth.Append(hndl) // add handle to path
        klaps(bk, npth, nmrk) // recursive call
    }
}