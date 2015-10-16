"use strict";
(function() {

Error.stackTraceLimit = Infinity;

var $global, $module;
if (typeof window !== "undefined") { /* web page */
  $global = window;
} else if (typeof self !== "undefined") { /* web worker */
  $global = self;
} else if (typeof global !== "undefined") { /* Node.js */
  $global = global;
  $global.require = require;
} else { /* others (e.g. Nashorn) */
  $global = this;
}

if ($global === undefined || $global.Array === undefined) {
  throw new Error("no global object found");
}
if (typeof module !== "undefined") {
  $module = module;
}

var $packages = {}, $idCounter = 0;
var $keys = function(m) { return m ? Object.keys(m) : []; };
var $min = Math.min;
var $mod = function(x, y) { return x % y; };
var $parseInt = parseInt;
var $parseFloat = function(f) {
  if (f !== undefined && f !== null && f.constructor === Number) {
    return f;
  }
  return parseFloat(f);
};
var $flushConsole = function() {};
var $throwRuntimeError; /* set by package "runtime" */
var $throwNilPointerError = function() { $throwRuntimeError("invalid memory address or nil pointer dereference"); };
var $call = function(fn, rcvr, args) { return fn.apply(rcvr, args); };
var $makeFunc = function(fn) { return function() { return fn(new ($sliceType($jsObjectPtr))($global.Array.prototype.slice.call(arguments, []))); } };

var $froundBuf = new Float32Array(1);
var $fround = Math.fround || function(f) { $froundBuf[0] = f; return $froundBuf[0]; };

var $mapArray = function(array, f) {
  var newArray = new array.constructor(array.length);
  for (var i = 0; i < array.length; i++) {
    newArray[i] = f(array[i]);
  }
  return newArray;
};

var $methodVal = function(recv, name) {
  var vals = recv.$methodVals || {};
  recv.$methodVals = vals; /* noop for primitives */
  var f = vals[name];
  if (f !== undefined) {
    return f;
  }
  var method = recv[name];
  f = function() {
    $stackDepthOffset--;
    try {
      return method.apply(recv, arguments);
    } finally {
      $stackDepthOffset++;
    }
  };
  vals[name] = f;
  return f;
};

var $methodExpr = function(typ, name) {
  var method = typ.prototype[name];
  if (method.$expr === undefined) {
    method.$expr = function() {
      $stackDepthOffset--;
      try {
        if (typ.wrapped) {
          arguments[0] = new typ(arguments[0]);
        }
        return Function.call.apply(method, arguments);
      } finally {
        $stackDepthOffset++;
      }
    };
  }
  return method.$expr;
};

var $ifaceMethodExprs = {};
var $ifaceMethodExpr = function(name) {
  var expr = $ifaceMethodExprs["$" + name];
  if (expr === undefined) {
    expr = $ifaceMethodExprs["$" + name] = function() {
      $stackDepthOffset--;
      try {
        return Function.call.apply(arguments[0][name], arguments);
      } finally {
        $stackDepthOffset++;
      }
    };
  }
  return expr;
};

var $subslice = function(slice, low, high, max) {
  if (low < 0 || high < low || max < high || high > slice.$capacity || max > slice.$capacity) {
    $throwRuntimeError("slice bounds out of range");
  }
  var s = new slice.constructor(slice.$array);
  s.$offset = slice.$offset + low;
  s.$length = slice.$length - low;
  s.$capacity = slice.$capacity - low;
  if (high !== undefined) {
    s.$length = high - low;
  }
  if (max !== undefined) {
    s.$capacity = max - low;
  }
  return s;
};

var $sliceToArray = function(slice) {
  if (slice.$length === 0) {
    return [];
  }
  if (slice.$array.constructor !== Array) {
    return slice.$array.subarray(slice.$offset, slice.$offset + slice.$length);
  }
  return slice.$array.slice(slice.$offset, slice.$offset + slice.$length);
};

var $decodeRune = function(str, pos) {
  var c0 = str.charCodeAt(pos);

  if (c0 < 0x80) {
    return [c0, 1];
  }

  if (c0 !== c0 || c0 < 0xC0) {
    return [0xFFFD, 1];
  }

  var c1 = str.charCodeAt(pos + 1);
  if (c1 !== c1 || c1 < 0x80 || 0xC0 <= c1) {
    return [0xFFFD, 1];
  }

  if (c0 < 0xE0) {
    var r = (c0 & 0x1F) << 6 | (c1 & 0x3F);
    if (r <= 0x7F) {
      return [0xFFFD, 1];
    }
    return [r, 2];
  }

  var c2 = str.charCodeAt(pos + 2);
  if (c2 !== c2 || c2 < 0x80 || 0xC0 <= c2) {
    return [0xFFFD, 1];
  }

  if (c0 < 0xF0) {
    var r = (c0 & 0x0F) << 12 | (c1 & 0x3F) << 6 | (c2 & 0x3F);
    if (r <= 0x7FF) {
      return [0xFFFD, 1];
    }
    if (0xD800 <= r && r <= 0xDFFF) {
      return [0xFFFD, 1];
    }
    return [r, 3];
  }

  var c3 = str.charCodeAt(pos + 3);
  if (c3 !== c3 || c3 < 0x80 || 0xC0 <= c3) {
    return [0xFFFD, 1];
  }

  if (c0 < 0xF8) {
    var r = (c0 & 0x07) << 18 | (c1 & 0x3F) << 12 | (c2 & 0x3F) << 6 | (c3 & 0x3F);
    if (r <= 0xFFFF || 0x10FFFF < r) {
      return [0xFFFD, 1];
    }
    return [r, 4];
  }

  return [0xFFFD, 1];
};

var $encodeRune = function(r) {
  if (r < 0 || r > 0x10FFFF || (0xD800 <= r && r <= 0xDFFF)) {
    r = 0xFFFD;
  }
  if (r <= 0x7F) {
    return String.fromCharCode(r);
  }
  if (r <= 0x7FF) {
    return String.fromCharCode(0xC0 | r >> 6, 0x80 | (r & 0x3F));
  }
  if (r <= 0xFFFF) {
    return String.fromCharCode(0xE0 | r >> 12, 0x80 | (r >> 6 & 0x3F), 0x80 | (r & 0x3F));
  }
  return String.fromCharCode(0xF0 | r >> 18, 0x80 | (r >> 12 & 0x3F), 0x80 | (r >> 6 & 0x3F), 0x80 | (r & 0x3F));
};

var $stringToBytes = function(str) {
  var array = new Uint8Array(str.length);
  for (var i = 0; i < str.length; i++) {
    array[i] = str.charCodeAt(i);
  }
  return array;
};

var $bytesToString = function(slice) {
  if (slice.$length === 0) {
    return "";
  }
  var str = "";
  for (var i = 0; i < slice.$length; i += 10000) {
    str += String.fromCharCode.apply(undefined, slice.$array.subarray(slice.$offset + i, slice.$offset + Math.min(slice.$length, i + 10000)));
  }
  return str;
};

var $stringToRunes = function(str) {
  var array = new Int32Array(str.length);
  var rune, j = 0;
  for (var i = 0; i < str.length; i += rune[1], j++) {
    rune = $decodeRune(str, i);
    array[j] = rune[0];
  }
  return array.subarray(0, j);
};

var $runesToString = function(slice) {
  if (slice.$length === 0) {
    return "";
  }
  var str = "";
  for (var i = 0; i < slice.$length; i++) {
    str += $encodeRune(slice.$array[slice.$offset + i]);
  }
  return str;
};

var $copyString = function(dst, src) {
  var n = Math.min(src.length, dst.$length);
  for (var i = 0; i < n; i++) {
    dst.$array[dst.$offset + i] = src.charCodeAt(i);
  }
  return n;
};

var $copySlice = function(dst, src) {
  var n = Math.min(src.$length, dst.$length);
  $copyArray(dst.$array, src.$array, dst.$offset, src.$offset, n, dst.constructor.elem);
  return n;
};

var $copy = function(dst, src, typ) {
  switch (typ.kind) {
  case $kindArray:
    $copyArray(dst, src, 0, 0, src.length, typ.elem);
    break;
  case $kindStruct:
    for (var i = 0; i < typ.fields.length; i++) {
      var f = typ.fields[i];
      switch (f.typ.kind) {
      case $kindArray:
      case $kindStruct:
        $copy(dst[f.prop], src[f.prop], f.typ);
        continue;
      default:
        dst[f.prop] = src[f.prop];
        continue;
      }
    }
    break;
  }
};

var $copyArray = function(dst, src, dstOffset, srcOffset, n, elem) {
  if (n === 0 || (dst === src && dstOffset === srcOffset)) {
    return;
  }

  if (src.subarray) {
    dst.set(src.subarray(srcOffset, srcOffset + n), dstOffset);
    return;
  }

  switch (elem.kind) {
  case $kindArray:
  case $kindStruct:
    if (dst === src && dstOffset > srcOffset) {
      for (var i = n - 1; i >= 0; i--) {
        $copy(dst[dstOffset + i], src[srcOffset + i], elem);
      }
      return;
    }
    for (var i = 0; i < n; i++) {
      $copy(dst[dstOffset + i], src[srcOffset + i], elem);
    }
    return;
  }

  if (dst === src && dstOffset > srcOffset) {
    for (var i = n - 1; i >= 0; i--) {
      dst[dstOffset + i] = src[srcOffset + i];
    }
    return;
  }
  for (var i = 0; i < n; i++) {
    dst[dstOffset + i] = src[srcOffset + i];
  }
};

var $clone = function(src, type) {
  var clone = type.zero();
  $copy(clone, src, type);
  return clone;
};

var $pointerOfStructConversion = function(obj, type) {
  if(obj.$proxies === undefined) {
    obj.$proxies = {};
    obj.$proxies[obj.constructor.string] = obj;
  }
  var proxy = obj.$proxies[type.string];
  if (proxy === undefined) {
    var properties = {};
    for (var i = 0; i < type.elem.fields.length; i++) {
      (function(fieldProp) {
        properties[fieldProp] = {
          get: function() { return obj[fieldProp]; },
          set: function(value) { obj[fieldProp] = value; }
        };
      })(type.elem.fields[i].prop);
    }
    proxy = Object.create(type.prototype, properties);
    proxy.$val = proxy;
    obj.$proxies[type.string] = proxy;
    proxy.$proxies = obj.$proxies;
  }
  return proxy;
};

var $append = function(slice) {
  return $internalAppend(slice, arguments, 1, arguments.length - 1);
};

var $appendSlice = function(slice, toAppend) {
  if (toAppend.constructor === String) {
    var bytes = $stringToBytes(toAppend);
    return $internalAppend(slice, bytes, 0, bytes.length);
  }
  return $internalAppend(slice, toAppend.$array, toAppend.$offset, toAppend.$length);
};

var $internalAppend = function(slice, array, offset, length) {
  if (length === 0) {
    return slice;
  }

  var newArray = slice.$array;
  var newOffset = slice.$offset;
  var newLength = slice.$length + length;
  var newCapacity = slice.$capacity;

  if (newLength > newCapacity) {
    newOffset = 0;
    newCapacity = Math.max(newLength, slice.$capacity < 1024 ? slice.$capacity * 2 : Math.floor(slice.$capacity * 5 / 4));

    if (slice.$array.constructor === Array) {
      newArray = slice.$array.slice(slice.$offset, slice.$offset + slice.$length);
      newArray.length = newCapacity;
      var zero = slice.constructor.elem.zero;
      for (var i = slice.$length; i < newCapacity; i++) {
        newArray[i] = zero();
      }
    } else {
      newArray = new slice.$array.constructor(newCapacity);
      newArray.set(slice.$array.subarray(slice.$offset, slice.$offset + slice.$length));
    }
  }

  $copyArray(newArray, array, newOffset + slice.$length, offset, length, slice.constructor.elem);

  var newSlice = new slice.constructor(newArray);
  newSlice.$offset = newOffset;
  newSlice.$length = newLength;
  newSlice.$capacity = newCapacity;
  return newSlice;
};

var $equal = function(a, b, type) {
  if (type === $jsObjectPtr) {
    return a === b;
  }
  switch (type.kind) {
  case $kindComplex64:
  case $kindComplex128:
    return a.$real === b.$real && a.$imag === b.$imag;
  case $kindInt64:
  case $kindUint64:
    return a.$high === b.$high && a.$low === b.$low;
  case $kindArray:
    if (a.length !== b.length) {
      return false;
    }
    for (var i = 0; i < a.length; i++) {
      if (!$equal(a[i], b[i], type.elem)) {
        return false;
      }
    }
    return true;
  case $kindStruct:
    for (var i = 0; i < type.fields.length; i++) {
      var f = type.fields[i];
      if (!$equal(a[f.prop], b[f.prop], f.typ)) {
        return false;
      }
    }
    return true;
  case $kindInterface:
    return $interfaceIsEqual(a, b);
  default:
    return a === b;
  }
};

var $interfaceIsEqual = function(a, b) {
  if (a === $ifaceNil || b === $ifaceNil) {
    return a === b;
  }
  if (a.constructor !== b.constructor) {
    return false;
  }
  if (a.constructor === $jsObjectPtr) {
    return a.object === b.object;
  }
  if (!a.constructor.comparable) {
    $throwRuntimeError("comparing uncomparable type " + a.constructor.string);
  }
  return $equal(a.$val, b.$val, a.constructor);
};

var $kindBool = 1;
var $kindInt = 2;
var $kindInt8 = 3;
var $kindInt16 = 4;
var $kindInt32 = 5;
var $kindInt64 = 6;
var $kindUint = 7;
var $kindUint8 = 8;
var $kindUint16 = 9;
var $kindUint32 = 10;
var $kindUint64 = 11;
var $kindUintptr = 12;
var $kindFloat32 = 13;
var $kindFloat64 = 14;
var $kindComplex64 = 15;
var $kindComplex128 = 16;
var $kindArray = 17;
var $kindChan = 18;
var $kindFunc = 19;
var $kindInterface = 20;
var $kindMap = 21;
var $kindPtr = 22;
var $kindSlice = 23;
var $kindString = 24;
var $kindStruct = 25;
var $kindUnsafePointer = 26;

var $methodSynthesizers = [];
var $addMethodSynthesizer = function(f) {
  if ($methodSynthesizers === null) {
    f();
    return;
  }
  $methodSynthesizers.push(f);
};
var $synthesizeMethods = function() {
  $methodSynthesizers.forEach(function(f) { f(); });
  $methodSynthesizers = null;
};

var $ifaceKeyFor = function(x) {
  if (x === $ifaceNil) {
    return 'nil';
  }
  var c = x.constructor;
  return c.string + '$' + c.keyFor(x.$val);
};

var $identity = function(x) { return x; };

var $typeIDCounter = 0;

var $idKey = function(x) {
  if (x.$id === undefined) {
    $idCounter++;
    x.$id = $idCounter;
  }
  return String(x.$id);
};

var $newType = function(size, kind, string, name, pkg, constructor) {
  var typ;
  switch(kind) {
  case $kindBool:
  case $kindInt:
  case $kindInt8:
  case $kindInt16:
  case $kindInt32:
  case $kindUint:
  case $kindUint8:
  case $kindUint16:
  case $kindUint32:
  case $kindUintptr:
  case $kindUnsafePointer:
    typ = function(v) { this.$val = v; };
    typ.wrapped = true;
    typ.keyFor = $identity;
    break;

  case $kindString:
    typ = function(v) { this.$val = v; };
    typ.wrapped = true;
    typ.keyFor = function(x) { return "$" + x; };
    break;

  case $kindFloat32:
  case $kindFloat64:
    typ = function(v) { this.$val = v; };
    typ.wrapped = true;
    typ.keyFor = function(x) { return $floatKey(x); };
    break;

  case $kindInt64:
    typ = function(high, low) {
      this.$high = (high + Math.floor(Math.ceil(low) / 4294967296)) >> 0;
      this.$low = low >>> 0;
      this.$val = this;
    };
    typ.keyFor = function(x) { return x.$high + "$" + x.$low; };
    break;

  case $kindUint64:
    typ = function(high, low) {
      this.$high = (high + Math.floor(Math.ceil(low) / 4294967296)) >>> 0;
      this.$low = low >>> 0;
      this.$val = this;
    };
    typ.keyFor = function(x) { return x.$high + "$" + x.$low; };
    break;

  case $kindComplex64:
    typ = function(real, imag) {
      this.$real = $fround(real);
      this.$imag = $fround(imag);
      this.$val = this;
    };
    typ.keyFor = function(x) { return x.$real + "$" + x.$imag; };
    break;

  case $kindComplex128:
    typ = function(real, imag) {
      this.$real = real;
      this.$imag = imag;
      this.$val = this;
    };
    typ.keyFor = function(x) { return x.$real + "$" + x.$imag; };
    break;

  case $kindArray:
    typ = function(v) { this.$val = v; };
    typ.wrapped = true;
    typ.ptr = $newType(4, $kindPtr, "*" + string, "", "", function(array) {
      this.$get = function() { return array; };
      this.$set = function(v) { $copy(this, v, typ); };
      this.$val = array;
    });
    typ.init = function(elem, len) {
      typ.elem = elem;
      typ.len = len;
      typ.comparable = elem.comparable;
      typ.keyFor = function(x) {
        return Array.prototype.join.call($mapArray(x, function(e) {
          return String(elem.keyFor(e)).replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
        }), "$");
      };
      typ.ptr.init(typ);
      Object.defineProperty(typ.ptr.nil, "nilCheck", { get: $throwNilPointerError });
    };
    break;

  case $kindChan:
    typ = function(v) { this.$val = v; };
    typ.wrapped = true;
    typ.keyFor = $idKey;
    typ.init = function(elem, sendOnly, recvOnly) {
      typ.elem = elem;
      typ.sendOnly = sendOnly;
      typ.recvOnly = recvOnly;
    };
    break;

  case $kindFunc:
    typ = function(v) { this.$val = v; };
    typ.wrapped = true;
    typ.init = function(params, results, variadic) {
      typ.params = params;
      typ.results = results;
      typ.variadic = variadic;
      typ.comparable = false;
    };
    break;

  case $kindInterface:
    typ = { implementedBy: {}, missingMethodFor: {} };
    typ.keyFor = $ifaceKeyFor;
    typ.init = function(methods) {
      typ.methods = methods;
      methods.forEach(function(m) {
        $ifaceNil[m.prop] = $throwNilPointerError;
      });
    };
    break;

  case $kindMap:
    typ = function(v) { this.$val = v; };
    typ.wrapped = true;
    typ.init = function(key, elem) {
      typ.key = key;
      typ.elem = elem;
      typ.comparable = false;
    };
    break;

  case $kindPtr:
    typ = constructor || function(getter, setter, target) {
      this.$get = getter;
      this.$set = setter;
      this.$target = target;
      this.$val = this;
    };
    typ.keyFor = $idKey;
    typ.init = function(elem) {
      typ.elem = elem;
      typ.wrapped = (elem.kind === $kindArray);
      typ.nil = new typ($throwNilPointerError, $throwNilPointerError);
    };
    break;

  case $kindSlice:
    typ = function(array) {
      if (array.constructor !== typ.nativeArray) {
        array = new typ.nativeArray(array);
      }
      this.$array = array;
      this.$offset = 0;
      this.$length = array.length;
      this.$capacity = array.length;
      this.$val = this;
    };
    typ.init = function(elem) {
      typ.elem = elem;
      typ.comparable = false;
      typ.nativeArray = $nativeArray(elem.kind);
      typ.nil = new typ([]);
    };
    break;

  case $kindStruct:
    typ = function(v) { this.$val = v; };
    typ.wrapped = true;
    typ.ptr = $newType(4, $kindPtr, "*" + string, "", "", constructor);
    typ.ptr.elem = typ;
    typ.ptr.prototype.$get = function() { return this; };
    typ.ptr.prototype.$set = function(v) { $copy(this, v, typ); };
    typ.init = function(fields) {
      typ.fields = fields;
      fields.forEach(function(f) {
        if (!f.typ.comparable) {
          typ.comparable = false;
        }
      });
      typ.keyFor = function(x) {
        var val = x.$val;
        return $mapArray(fields, function(f) {
          return String(f.typ.keyFor(val[f.prop])).replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
        }).join("$");
      };
      /* nil value */
      var properties = {};
      fields.forEach(function(f) {
        properties[f.prop] = { get: $throwNilPointerError, set: $throwNilPointerError };
      });
      typ.ptr.nil = Object.create(constructor.prototype, properties);
      typ.ptr.nil.$val = typ.ptr.nil;
      /* methods for embedded fields */
      $addMethodSynthesizer(function() {
        var synthesizeMethod = function(target, m, f) {
          if (target.prototype[m.prop] !== undefined) { return; }
          target.prototype[m.prop] = function() {
            var v = this.$val[f.prop];
            if (f.typ === $jsObjectPtr) {
              v = new $jsObjectPtr(v);
            }
            if (v.$val === undefined) {
              v = new f.typ(v);
            }
            return v[m.prop].apply(v, arguments);
          };
        };
        fields.forEach(function(f) {
          if (f.name === "") {
            $methodSet(f.typ).forEach(function(m) {
              synthesizeMethod(typ, m, f);
              synthesizeMethod(typ.ptr, m, f);
            });
            $methodSet($ptrType(f.typ)).forEach(function(m) {
              synthesizeMethod(typ.ptr, m, f);
            });
          }
        });
      });
    };
    break;

  default:
    $panic(new $String("invalid kind: " + kind));
  }

  switch (kind) {
  case $kindBool:
  case $kindMap:
    typ.zero = function() { return false; };
    break;

  case $kindInt:
  case $kindInt8:
  case $kindInt16:
  case $kindInt32:
  case $kindUint:
  case $kindUint8 :
  case $kindUint16:
  case $kindUint32:
  case $kindUintptr:
  case $kindUnsafePointer:
  case $kindFloat32:
  case $kindFloat64:
    typ.zero = function() { return 0; };
    break;

  case $kindString:
    typ.zero = function() { return ""; };
    break;

  case $kindInt64:
  case $kindUint64:
  case $kindComplex64:
  case $kindComplex128:
    var zero = new typ(0, 0);
    typ.zero = function() { return zero; };
    break;

  case $kindPtr:
  case $kindSlice:
    typ.zero = function() { return typ.nil; };
    break;

  case $kindChan:
    typ.zero = function() { return $chanNil; };

  case $kindFunc:
    typ.zero = function() { return $throwNilPointerError; };
    break;

  case $kindInterface:
    typ.zero = function() { return $ifaceNil; };
    break;

  case $kindArray:
    typ.zero = function() {
      var arrayClass = $nativeArray(typ.elem.kind);
      if (arrayClass !== Array) {
        return new arrayClass(typ.len);
      }
      var array = new Array(typ.len);
      for (var i = 0; i < typ.len; i++) {
        array[i] = typ.elem.zero();
      }
      return array;
    };
    break;

  case $kindStruct:
    typ.zero = function() { return new typ.ptr(); };
    break;

  default:
    $panic(new $String("invalid kind: " + kind));
  }

  typ.id = $typeIDCounter;
  $typeIDCounter++;
  typ.size = size;
  typ.kind = kind;
  typ.string = string;
  typ.typeName = name;
  typ.pkg = pkg;
  typ.methods = [];
  typ.methodSetCache = null;
  typ.comparable = true;
  return typ;
};

var $methodSet = function(typ) {
  if (typ.methodSetCache !== null) {
    return typ.methodSetCache;
  }
  var base = {};

  var isPtr = (typ.kind === $kindPtr);
  if (isPtr && typ.elem.kind === $kindInterface) {
    typ.methodSetCache = [];
    return [];
  }

  var current = [{typ: isPtr ? typ.elem : typ, indirect: isPtr}];

  var seen = {};

  while (current.length > 0) {
    var next = [];
    var mset = [];

    current.forEach(function(e) {
      if (seen[e.typ.string]) {
        return;
      }
      seen[e.typ.string] = true;

      if(e.typ.typeName !== "") {
        mset = mset.concat(e.typ.methods);
        if (e.indirect) {
          mset = mset.concat($ptrType(e.typ).methods);
        }
      }

      switch (e.typ.kind) {
      case $kindStruct:
        e.typ.fields.forEach(function(f) {
          if (f.name === "") {
            var fTyp = f.typ;
            var fIsPtr = (fTyp.kind === $kindPtr);
            next.push({typ: fIsPtr ? fTyp.elem : fTyp, indirect: e.indirect || fIsPtr});
          }
        });
        break;

      case $kindInterface:
        mset = mset.concat(e.typ.methods);
        break;
      }
    });

    mset.forEach(function(m) {
      if (base[m.name] === undefined) {
        base[m.name] = m;
      }
    });

    current = next;
  }

  typ.methodSetCache = [];
  Object.keys(base).sort().forEach(function(name) {
    typ.methodSetCache.push(base[name]);
  });
  return typ.methodSetCache;
};

var $Bool          = $newType( 1, $kindBool,          "bool",           "bool",       "", null);
var $Int           = $newType( 4, $kindInt,           "int",            "int",        "", null);
var $Int8          = $newType( 1, $kindInt8,          "int8",           "int8",       "", null);
var $Int16         = $newType( 2, $kindInt16,         "int16",          "int16",      "", null);
var $Int32         = $newType( 4, $kindInt32,         "int32",          "int32",      "", null);
var $Int64         = $newType( 8, $kindInt64,         "int64",          "int64",      "", null);
var $Uint          = $newType( 4, $kindUint,          "uint",           "uint",       "", null);
var $Uint8         = $newType( 1, $kindUint8,         "uint8",          "uint8",      "", null);
var $Uint16        = $newType( 2, $kindUint16,        "uint16",         "uint16",     "", null);
var $Uint32        = $newType( 4, $kindUint32,        "uint32",         "uint32",     "", null);
var $Uint64        = $newType( 8, $kindUint64,        "uint64",         "uint64",     "", null);
var $Uintptr       = $newType( 4, $kindUintptr,       "uintptr",        "uintptr",    "", null);
var $Float32       = $newType( 4, $kindFloat32,       "float32",        "float32",    "", null);
var $Float64       = $newType( 8, $kindFloat64,       "float64",        "float64",    "", null);
var $Complex64     = $newType( 8, $kindComplex64,     "complex64",      "complex64",  "", null);
var $Complex128    = $newType(16, $kindComplex128,    "complex128",     "complex128", "", null);
var $String        = $newType( 8, $kindString,        "string",         "string",     "", null);
var $UnsafePointer = $newType( 4, $kindUnsafePointer, "unsafe.Pointer", "Pointer",    "", null);

var $nativeArray = function(elemKind) {
  switch (elemKind) {
  case $kindInt:
    return Int32Array;
  case $kindInt8:
    return Int8Array;
  case $kindInt16:
    return Int16Array;
  case $kindInt32:
    return Int32Array;
  case $kindUint:
    return Uint32Array;
  case $kindUint8:
    return Uint8Array;
  case $kindUint16:
    return Uint16Array;
  case $kindUint32:
    return Uint32Array;
  case $kindUintptr:
    return Uint32Array;
  case $kindFloat32:
    return Float32Array;
  case $kindFloat64:
    return Float64Array;
  default:
    return Array;
  }
};
var $toNativeArray = function(elemKind, array) {
  var nativeArray = $nativeArray(elemKind);
  if (nativeArray === Array) {
    return array;
  }
  return new nativeArray(array);
};
var $arrayTypes = {};
var $arrayType = function(elem, len) {
  var typeKey = elem.id + "$" + len;
  var typ = $arrayTypes[typeKey];
  if (typ === undefined) {
    typ = $newType(12, $kindArray, "[" + len + "]" + elem.string, "", "", null);
    $arrayTypes[typeKey] = typ;
    typ.init(elem, len);
  }
  return typ;
};

var $chanType = function(elem, sendOnly, recvOnly) {
  var string = (recvOnly ? "<-" : "") + "chan" + (sendOnly ? "<- " : " ") + elem.string;
  var field = sendOnly ? "SendChan" : (recvOnly ? "RecvChan" : "Chan");
  var typ = elem[field];
  if (typ === undefined) {
    typ = $newType(4, $kindChan, string, "", "", null);
    elem[field] = typ;
    typ.init(elem, sendOnly, recvOnly);
  }
  return typ;
};
var $Chan = function(elem, capacity) {
  if (capacity < 0 || capacity > 2147483647) {
    $throwRuntimeError("makechan: size out of range");
  }
  this.$elem = elem;
  this.$capacity = capacity;
  this.$buffer = [];
  this.$sendQueue = [];
  this.$recvQueue = [];
  this.$closed = false;
};
var $chanNil = new $Chan(null, 0);
$chanNil.$sendQueue = $chanNil.$recvQueue = { length: 0, push: function() {}, shift: function() { return undefined; }, indexOf: function() { return -1; } };

var $funcTypes = {};
var $funcType = function(params, results, variadic) {
  var typeKey = $mapArray(params, function(p) { return p.id; }).join(",") + "$" + $mapArray(results, function(r) { return r.id; }).join(",") + "$" + variadic;
  var typ = $funcTypes[typeKey];
  if (typ === undefined) {
    var paramTypes = $mapArray(params, function(p) { return p.string; });
    if (variadic) {
      paramTypes[paramTypes.length - 1] = "..." + paramTypes[paramTypes.length - 1].substr(2);
    }
    var string = "func(" + paramTypes.join(", ") + ")";
    if (results.length === 1) {
      string += " " + results[0].string;
    } else if (results.length > 1) {
      string += " (" + $mapArray(results, function(r) { return r.string; }).join(", ") + ")";
    }
    typ = $newType(4, $kindFunc, string, "", "", null);
    $funcTypes[typeKey] = typ;
    typ.init(params, results, variadic);
  }
  return typ;
};

var $interfaceTypes = {};
var $interfaceType = function(methods) {
  var typeKey = $mapArray(methods, function(m) { return m.pkg + "," + m.name + "," + m.typ.id; }).join("$");
  var typ = $interfaceTypes[typeKey];
  if (typ === undefined) {
    var string = "interface {}";
    if (methods.length !== 0) {
      string = "interface { " + $mapArray(methods, function(m) {
        return (m.pkg !== "" ? m.pkg + "." : "") + m.name + m.typ.string.substr(4);
      }).join("; ") + " }";
    }
    typ = $newType(8, $kindInterface, string, "", "", null);
    $interfaceTypes[typeKey] = typ;
    typ.init(methods);
  }
  return typ;
};
var $emptyInterface = $interfaceType([]);
var $ifaceNil = {};
var $error = $newType(8, $kindInterface, "error", "error", "", null);
$error.init([{prop: "Error", name: "Error", pkg: "", typ: $funcType([], [$String], false)}]);

var $mapTypes = {};
var $mapType = function(key, elem) {
  var typeKey = key.id + "$" + elem.id;
  var typ = $mapTypes[typeKey];
  if (typ === undefined) {
    typ = $newType(4, $kindMap, "map[" + key.string + "]" + elem.string, "", "", null);
    $mapTypes[typeKey] = typ;
    typ.init(key, elem);
  }
  return typ;
};
var $makeMap = function(keyForFunc, entries) {
  var m = {};
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    m[keyForFunc(e.k)] = e;
  }
  return m;
};

var $ptrType = function(elem) {
  var typ = elem.ptr;
  if (typ === undefined) {
    typ = $newType(4, $kindPtr, "*" + elem.string, "", "", null);
    elem.ptr = typ;
    typ.init(elem);
  }
  return typ;
};

var $newDataPointer = function(data, constructor) {
  if (constructor.elem.kind === $kindStruct) {
    return data;
  }
  return new constructor(function() { return data; }, function(v) { data = v; });
};

var $indexPtr = function(array, index, constructor) {
  array.$ptr = array.$ptr || {};
  return array.$ptr[index] || (array.$ptr[index] = new constructor(function() { return array[index]; }, function(v) { array[index] = v; }));
};

var $sliceType = function(elem) {
  var typ = elem.slice;
  if (typ === undefined) {
    typ = $newType(12, $kindSlice, "[]" + elem.string, "", "", null);
    elem.slice = typ;
    typ.init(elem);
  }
  return typ;
};
var $makeSlice = function(typ, length, capacity) {
  capacity = capacity || length;
  if (length < 0 || length > 2147483647) {
    $throwRuntimeError("makeslice: len out of range");
  }
  if (capacity < 0 || capacity < length || capacity > 2147483647) {
    $throwRuntimeError("makeslice: cap out of range");
  }
  var array = new typ.nativeArray(capacity);
  if (typ.nativeArray === Array) {
    for (var i = 0; i < capacity; i++) {
      array[i] = typ.elem.zero();
    }
  }
  var slice = new typ(array);
  slice.$length = length;
  return slice;
};

var $structTypes = {};
var $structType = function(fields) {
  var typeKey = $mapArray(fields, function(f) { return f.name + "," + f.typ.id + "," + f.tag; }).join("$");
  var typ = $structTypes[typeKey];
  if (typ === undefined) {
    var string = "struct { " + $mapArray(fields, function(f) {
      return f.name + " " + f.typ.string + (f.tag !== "" ? (" \"" + f.tag.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\"") : "");
    }).join("; ") + " }";
    if (fields.length === 0) {
      string = "struct {}";
    }
    typ = $newType(0, $kindStruct, string, "", "", function() {
      this.$val = this;
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        var arg = arguments[i];
        this[f.prop] = arg !== undefined ? arg : f.typ.zero();
      }
    });
    $structTypes[typeKey] = typ;
    typ.init(fields);
  }
  return typ;
};

var $assertType = function(value, type, returnTuple) {
  var isInterface = (type.kind === $kindInterface), ok, missingMethod = "";
  if (value === $ifaceNil) {
    ok = false;
  } else if (!isInterface) {
    ok = value.constructor === type;
  } else {
    var valueTypeString = value.constructor.string;
    ok = type.implementedBy[valueTypeString];
    if (ok === undefined) {
      ok = true;
      var valueMethodSet = $methodSet(value.constructor);
      var interfaceMethods = type.methods;
      for (var i = 0; i < interfaceMethods.length; i++) {
        var tm = interfaceMethods[i];
        var found = false;
        for (var j = 0; j < valueMethodSet.length; j++) {
          var vm = valueMethodSet[j];
          if (vm.name === tm.name && vm.pkg === tm.pkg && vm.typ === tm.typ) {
            found = true;
            break;
          }
        }
        if (!found) {
          ok = false;
          type.missingMethodFor[valueTypeString] = tm.name;
          break;
        }
      }
      type.implementedBy[valueTypeString] = ok;
    }
    if (!ok) {
      missingMethod = type.missingMethodFor[valueTypeString];
    }
  }

  if (!ok) {
    if (returnTuple) {
      return [type.zero(), false];
    }
    $panic(new $packages["runtime"].TypeAssertionError.ptr("", (value === $ifaceNil ? "" : value.constructor.string), type.string, missingMethod));
  }

  if (!isInterface) {
    value = value.$val;
  }
  if (type === $jsObjectPtr) {
    value = value.object;
  }
  return returnTuple ? [value, true] : value;
};

var $floatKey = function(f) {
  if (f !== f) {
    $idCounter++;
    return "NaN$" + $idCounter;
  }
  return String(f);
};

var $flatten64 = function(x) {
  return x.$high * 4294967296 + x.$low;
};

var $shiftLeft64 = function(x, y) {
  if (y === 0) {
    return x;
  }
  if (y < 32) {
    return new x.constructor(x.$high << y | x.$low >>> (32 - y), (x.$low << y) >>> 0);
  }
  if (y < 64) {
    return new x.constructor(x.$low << (y - 32), 0);
  }
  return new x.constructor(0, 0);
};

var $shiftRightInt64 = function(x, y) {
  if (y === 0) {
    return x;
  }
  if (y < 32) {
    return new x.constructor(x.$high >> y, (x.$low >>> y | x.$high << (32 - y)) >>> 0);
  }
  if (y < 64) {
    return new x.constructor(x.$high >> 31, (x.$high >> (y - 32)) >>> 0);
  }
  if (x.$high < 0) {
    return new x.constructor(-1, 4294967295);
  }
  return new x.constructor(0, 0);
};

var $shiftRightUint64 = function(x, y) {
  if (y === 0) {
    return x;
  }
  if (y < 32) {
    return new x.constructor(x.$high >>> y, (x.$low >>> y | x.$high << (32 - y)) >>> 0);
  }
  if (y < 64) {
    return new x.constructor(0, x.$high >>> (y - 32));
  }
  return new x.constructor(0, 0);
};

var $mul64 = function(x, y) {
  var high = 0, low = 0;
  if ((y.$low & 1) !== 0) {
    high = x.$high;
    low = x.$low;
  }
  for (var i = 1; i < 32; i++) {
    if ((y.$low & 1<<i) !== 0) {
      high += x.$high << i | x.$low >>> (32 - i);
      low += (x.$low << i) >>> 0;
    }
  }
  for (var i = 0; i < 32; i++) {
    if ((y.$high & 1<<i) !== 0) {
      high += x.$low << i;
    }
  }
  return new x.constructor(high, low);
};

var $div64 = function(x, y, returnRemainder) {
  if (y.$high === 0 && y.$low === 0) {
    $throwRuntimeError("integer divide by zero");
  }

  var s = 1;
  var rs = 1;

  var xHigh = x.$high;
  var xLow = x.$low;
  if (xHigh < 0) {
    s = -1;
    rs = -1;
    xHigh = -xHigh;
    if (xLow !== 0) {
      xHigh--;
      xLow = 4294967296 - xLow;
    }
  }

  var yHigh = y.$high;
  var yLow = y.$low;
  if (y.$high < 0) {
    s *= -1;
    yHigh = -yHigh;
    if (yLow !== 0) {
      yHigh--;
      yLow = 4294967296 - yLow;
    }
  }

  var high = 0, low = 0, n = 0;
  while (yHigh < 2147483648 && ((xHigh > yHigh) || (xHigh === yHigh && xLow > yLow))) {
    yHigh = (yHigh << 1 | yLow >>> 31) >>> 0;
    yLow = (yLow << 1) >>> 0;
    n++;
  }
  for (var i = 0; i <= n; i++) {
    high = high << 1 | low >>> 31;
    low = (low << 1) >>> 0;
    if ((xHigh > yHigh) || (xHigh === yHigh && xLow >= yLow)) {
      xHigh = xHigh - yHigh;
      xLow = xLow - yLow;
      if (xLow < 0) {
        xHigh--;
        xLow += 4294967296;
      }
      low++;
      if (low === 4294967296) {
        high++;
        low = 0;
      }
    }
    yLow = (yLow >>> 1 | yHigh << (32 - 1)) >>> 0;
    yHigh = yHigh >>> 1;
  }

  if (returnRemainder) {
    return new x.constructor(xHigh * rs, xLow * rs);
  }
  return new x.constructor(high * s, low * s);
};

var $divComplex = function(n, d) {
  var ninf = n.$real === 1/0 || n.$real === -1/0 || n.$imag === 1/0 || n.$imag === -1/0;
  var dinf = d.$real === 1/0 || d.$real === -1/0 || d.$imag === 1/0 || d.$imag === -1/0;
  var nnan = !ninf && (n.$real !== n.$real || n.$imag !== n.$imag);
  var dnan = !dinf && (d.$real !== d.$real || d.$imag !== d.$imag);
  if(nnan || dnan) {
    return new n.constructor(0/0, 0/0);
  }
  if (ninf && !dinf) {
    return new n.constructor(1/0, 1/0);
  }
  if (!ninf && dinf) {
    return new n.constructor(0, 0);
  }
  if (d.$real === 0 && d.$imag === 0) {
    if (n.$real === 0 && n.$imag === 0) {
      return new n.constructor(0/0, 0/0);
    }
    return new n.constructor(1/0, 1/0);
  }
  var a = Math.abs(d.$real);
  var b = Math.abs(d.$imag);
  if (a <= b) {
    var ratio = d.$real / d.$imag;
    var denom = d.$real * ratio + d.$imag;
    return new n.constructor((n.$real * ratio + n.$imag) / denom, (n.$imag * ratio - n.$real) / denom);
  }
  var ratio = d.$imag / d.$real;
  var denom = d.$imag * ratio + d.$real;
  return new n.constructor((n.$imag * ratio + n.$real) / denom, (n.$imag - n.$real * ratio) / denom);
};

var $stackDepthOffset = 0;
var $getStackDepth = function() {
  var err = new Error();
  if (err.stack === undefined) {
    return undefined;
  }
  return $stackDepthOffset + err.stack.split("\n").length;
};

var $panicStackDepth = null, $panicValue;
var $callDeferred = function(deferred, jsErr, fromPanic) {
  if (!fromPanic && deferred !== null && deferred.index >= $curGoroutine.deferStack.length) {
    throw jsErr;
  }
  if (jsErr !== null) {
    var newErr = null;
    try {
      $curGoroutine.deferStack.push(deferred);
      $panic(new $jsErrorPtr(jsErr));
    } catch (err) {
      newErr = err;
    }
    $curGoroutine.deferStack.pop();
    $callDeferred(deferred, newErr);
    return;
  }
  if ($curGoroutine.asleep) {
    return;
  }

  $stackDepthOffset--;
  var outerPanicStackDepth = $panicStackDepth;
  var outerPanicValue = $panicValue;

  var localPanicValue = $curGoroutine.panicStack.pop();
  if (localPanicValue !== undefined) {
    $panicStackDepth = $getStackDepth();
    $panicValue = localPanicValue;
  }

  try {
    while (true) {
      if (deferred === null) {
        deferred = $curGoroutine.deferStack[$curGoroutine.deferStack.length - 1];
        if (deferred === undefined) {
          /* The panic reached the top of the stack. Clear it and throw it as a JavaScript error. */
          $panicStackDepth = null;
          if (localPanicValue.Object instanceof Error) {
            throw localPanicValue.Object;
          }
          var msg;
          if (localPanicValue.constructor === $String) {
            msg = localPanicValue.$val;
          } else if (localPanicValue.Error !== undefined) {
            msg = localPanicValue.Error();
          } else if (localPanicValue.String !== undefined) {
            msg = localPanicValue.String();
          } else {
            msg = localPanicValue;
          }
          throw new Error(msg);
        }
      }
      var call = deferred.pop();
      if (call === undefined) {
        $curGoroutine.deferStack.pop();
        if (localPanicValue !== undefined) {
          deferred = null;
          continue;
        }
        return;
      }
      var r = call[0].apply(call[2], call[1]);
      if (r && r.$blk !== undefined) {
        deferred.push([r.$blk, [], r]);
        if (fromPanic) {
          throw null;
        }
        return;
      }

      if (localPanicValue !== undefined && $panicStackDepth === null) {
        throw null; /* error was recovered */
      }
    }
  } finally {
    if (localPanicValue !== undefined) {
      if ($panicStackDepth !== null) {
        $curGoroutine.panicStack.push(localPanicValue);
      }
      $panicStackDepth = outerPanicStackDepth;
      $panicValue = outerPanicValue;
    }
    $stackDepthOffset++;
  }
};

var $panic = function(value) {
  $curGoroutine.panicStack.push(value);
  $callDeferred(null, null, true);
};
var $recover = function() {
  if ($panicStackDepth === null || ($panicStackDepth !== undefined && $panicStackDepth !== $getStackDepth() - 2)) {
    return $ifaceNil;
  }
  $panicStackDepth = null;
  return $panicValue;
};
var $throw = function(err) { throw err; };

var $dummyGoroutine = { asleep: false, exit: false, deferStack: [], panicStack: [], canBlock: false };
var $curGoroutine = $dummyGoroutine, $totalGoroutines = 0, $awakeGoroutines = 0, $checkForDeadlock = true;
var $go = function(fun, args, direct) {
  $totalGoroutines++;
  $awakeGoroutines++;
  var $goroutine = function() {
    var rescheduled = false;
    try {
      $curGoroutine = $goroutine;
      var r = fun.apply(undefined, args);
      if (r && r.$blk !== undefined) {
        fun = function() { return r.$blk(); };
        args = [];
        rescheduled = true;
        return;
      }
      $goroutine.exit = true;
    } catch (err) {
      $goroutine.exit = true;
      throw err;
    } finally {
      $curGoroutine = $dummyGoroutine;
      if ($goroutine.exit && !rescheduled) { /* also set by runtime.Goexit() */
        $totalGoroutines--;
        $goroutine.asleep = true;
      }
      if ($goroutine.asleep && !rescheduled) {
        $awakeGoroutines--;
        if ($awakeGoroutines === 0 && $totalGoroutines !== 0 && $checkForDeadlock) {
          console.error("fatal error: all goroutines are asleep - deadlock!");
        }
      }
    }
  };
  $goroutine.asleep = false;
  $goroutine.exit = false;
  $goroutine.deferStack = [];
  $goroutine.panicStack = [];
  $goroutine.canBlock = true;
  $schedule($goroutine, direct);
};

var $scheduled = [], $schedulerActive = false;
var $runScheduled = function() {
  try {
    var r;
    while ((r = $scheduled.shift()) !== undefined) {
      r();
    }
    $schedulerActive = false;
  } finally {
    if ($schedulerActive) {
      setTimeout($runScheduled, 0);
    }
  }
};
var $schedule = function(goroutine, direct) {
  if (goroutine.asleep) {
    goroutine.asleep = false;
    $awakeGoroutines++;
  }

  if (direct) {
    goroutine();
    return;
  }

  $scheduled.push(goroutine);
  if (!$schedulerActive) {
    $schedulerActive = true;
    setTimeout($runScheduled, 0);
  }
};

var $block = function() {
  if (!$curGoroutine.canBlock) {
    $throwRuntimeError("cannot block in JavaScript callback, fix by wrapping code in goroutine");
  }
  $curGoroutine.asleep = true;
};

var $send = function(chan, value) {
  if (chan.$closed) {
    $throwRuntimeError("send on closed channel");
  }
  var queuedRecv = chan.$recvQueue.shift();
  if (queuedRecv !== undefined) {
    queuedRecv([value, true]);
    return;
  }
  if (chan.$buffer.length < chan.$capacity) {
    chan.$buffer.push(value);
    return;
  }

  var thisGoroutine = $curGoroutine;
  chan.$sendQueue.push(function() {
    $schedule(thisGoroutine);
    return value;
  });
  $block();
  return {
    $blk: function() {
      if (chan.$closed) {
        $throwRuntimeError("send on closed channel");
      }
    }
  };
};
var $recv = function(chan) {
  var queuedSend = chan.$sendQueue.shift();
  if (queuedSend !== undefined) {
    chan.$buffer.push(queuedSend());
  }
  var bufferedValue = chan.$buffer.shift();
  if (bufferedValue !== undefined) {
    return [bufferedValue, true];
  }
  if (chan.$closed) {
    return [chan.$elem.zero(), false];
  }

  var thisGoroutine = $curGoroutine;
  var f = { $blk: function() { return this.value; } };
  var queueEntry = function(v) {
    f.value = v;
    $schedule(thisGoroutine);
  };
  chan.$recvQueue.push(queueEntry);
  $block();
  return f;
};
var $close = function(chan) {
  if (chan.$closed) {
    $throwRuntimeError("close of closed channel");
  }
  chan.$closed = true;
  while (true) {
    var queuedSend = chan.$sendQueue.shift();
    if (queuedSend === undefined) {
      break;
    }
    queuedSend(); /* will panic because of closed channel */
  }
  while (true) {
    var queuedRecv = chan.$recvQueue.shift();
    if (queuedRecv === undefined) {
      break;
    }
    queuedRecv([chan.$elem.zero(), false]);
  }
};
var $select = function(comms) {
  var ready = [];
  var selection = -1;
  for (var i = 0; i < comms.length; i++) {
    var comm = comms[i];
    var chan = comm[0];
    switch (comm.length) {
    case 0: /* default */
      selection = i;
      break;
    case 1: /* recv */
      if (chan.$sendQueue.length !== 0 || chan.$buffer.length !== 0 || chan.$closed) {
        ready.push(i);
      }
      break;
    case 2: /* send */
      if (chan.$closed) {
        $throwRuntimeError("send on closed channel");
      }
      if (chan.$recvQueue.length !== 0 || chan.$buffer.length < chan.$capacity) {
        ready.push(i);
      }
      break;
    }
  }

  if (ready.length !== 0) {
    selection = ready[Math.floor(Math.random() * ready.length)];
  }
  if (selection !== -1) {
    var comm = comms[selection];
    switch (comm.length) {
    case 0: /* default */
      return [selection];
    case 1: /* recv */
      return [selection, $recv(comm[0])];
    case 2: /* send */
      $send(comm[0], comm[1]);
      return [selection];
    }
  }

  var entries = [];
  var thisGoroutine = $curGoroutine;
  var f = { $blk: function() { return this.selection; } };
  var removeFromQueues = function() {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var queue = entry[0];
      var index = queue.indexOf(entry[1]);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    }
  };
  for (var i = 0; i < comms.length; i++) {
    (function(i) {
      var comm = comms[i];
      switch (comm.length) {
      case 1: /* recv */
        var queueEntry = function(value) {
          f.selection = [i, value];
          removeFromQueues();
          $schedule(thisGoroutine);
        };
        entries.push([comm[0].$recvQueue, queueEntry]);
        comm[0].$recvQueue.push(queueEntry);
        break;
      case 2: /* send */
        var queueEntry = function() {
          if (comm[0].$closed) {
            $throwRuntimeError("send on closed channel");
          }
          f.selection = [i];
          removeFromQueues();
          $schedule(thisGoroutine);
          return comm[1];
        };
        entries.push([comm[0].$sendQueue, queueEntry]);
        comm[0].$sendQueue.push(queueEntry);
        break;
      }
    })(i);
  }
  $block();
  return f;
};

var $jsObjectPtr, $jsErrorPtr;

var $needsExternalization = function(t) {
  switch (t.kind) {
    case $kindBool:
    case $kindInt:
    case $kindInt8:
    case $kindInt16:
    case $kindInt32:
    case $kindUint:
    case $kindUint8:
    case $kindUint16:
    case $kindUint32:
    case $kindUintptr:
    case $kindFloat32:
    case $kindFloat64:
      return false;
    default:
      return t !== $jsObjectPtr;
  }
};

var $externalize = function(v, t) {
  if (t === $jsObjectPtr) {
    return v;
  }
  switch (t.kind) {
  case $kindBool:
  case $kindInt:
  case $kindInt8:
  case $kindInt16:
  case $kindInt32:
  case $kindUint:
  case $kindUint8:
  case $kindUint16:
  case $kindUint32:
  case $kindUintptr:
  case $kindFloat32:
  case $kindFloat64:
    return v;
  case $kindInt64:
  case $kindUint64:
    return $flatten64(v);
  case $kindArray:
    if ($needsExternalization(t.elem)) {
      return $mapArray(v, function(e) { return $externalize(e, t.elem); });
    }
    return v;
  case $kindFunc:
    return $externalizeFunction(v, t, false);
  case $kindInterface:
    if (v === $ifaceNil) {
      return null;
    }
    if (v.constructor === $jsObjectPtr) {
      return v.$val.object;
    }
    return $externalize(v.$val, v.constructor);
  case $kindMap:
    var m = {};
    var keys = $keys(v);
    for (var i = 0; i < keys.length; i++) {
      var entry = v[keys[i]];
      m[$externalize(entry.k, t.key)] = $externalize(entry.v, t.elem);
    }
    return m;
  case $kindPtr:
    if (v === t.nil) {
      return null;
    }
    return $externalize(v.$get(), t.elem);
  case $kindSlice:
    if ($needsExternalization(t.elem)) {
      return $mapArray($sliceToArray(v), function(e) { return $externalize(e, t.elem); });
    }
    return $sliceToArray(v);
  case $kindString:
    if (v.search(/^[\x00-\x7F]*$/) !== -1) {
      return v;
    }
    var s = "", r;
    for (var i = 0; i < v.length; i += r[1]) {
      r = $decodeRune(v, i);
      var c = r[0];
      if (c > 0xFFFF) {
        var h = Math.floor((c - 0x10000) / 0x400) + 0xD800;
        var l = (c - 0x10000) % 0x400 + 0xDC00;
        s += String.fromCharCode(h, l);
        continue;
      }
      s += String.fromCharCode(c);
    }
    return s;
  case $kindStruct:
    var timePkg = $packages["time"];
    if (timePkg !== undefined && v.constructor === timePkg.Time.ptr) {
      var milli = $div64(v.UnixNano(), new $Int64(0, 1000000));
      return new Date($flatten64(milli));
    }

    var noJsObject = {};
    var searchJsObject = function(v, t) {
      if (t === $jsObjectPtr) {
        return v;
      }
      switch (t.kind) {
      case $kindPtr:
        if (v === t.nil) {
          return noJsObject;
        }
        return searchJsObject(v.$get(), t.elem);
      case $kindStruct:
        var f = t.fields[0];
        return searchJsObject(v[f.prop], f.typ);
      case $kindInterface:
        return searchJsObject(v.$val, v.constructor);
      default:
        return noJsObject;
      }
    };
    var o = searchJsObject(v, t);
    if (o !== noJsObject) {
      return o;
    }

    o = {};
    for (var i = 0; i < t.fields.length; i++) {
      var f = t.fields[i];
      if (f.pkg !== "") { /* not exported */
        continue;
      }
      o[f.name] = $externalize(v[f.prop], f.typ);
    }
    return o;
  }
  $panic(new $String("cannot externalize " + t.string));
};

var $externalizeFunction = function(v, t, passThis) {
  if (v === $throwNilPointerError) {
    return null;
  }
  if (v.$externalizeWrapper === undefined) {
    $checkForDeadlock = false;
    v.$externalizeWrapper = function() {
      var args = [];
      for (var i = 0; i < t.params.length; i++) {
        if (t.variadic && i === t.params.length - 1) {
          var vt = t.params[i].elem, varargs = [];
          for (var j = i; j < arguments.length; j++) {
            varargs.push($internalize(arguments[j], vt));
          }
          args.push(new (t.params[i])(varargs));
          break;
        }
        args.push($internalize(arguments[i], t.params[i]));
      }
      var canBlock = $curGoroutine.canBlock;
      $curGoroutine.canBlock = false;
      try {
        var result = v.apply(passThis ? this : undefined, args);
      } finally {
        $curGoroutine.canBlock = canBlock;
      }
      switch (t.results.length) {
      case 0:
        return;
      case 1:
        return $externalize(result, t.results[0]);
      default:
        for (var i = 0; i < t.results.length; i++) {
          result[i] = $externalize(result[i], t.results[i]);
        }
        return result;
      }
    };
  }
  return v.$externalizeWrapper;
};

var $internalize = function(v, t, recv) {
  if (t === $jsObjectPtr) {
    return v;
  }
  if (t === $jsObjectPtr.elem) {
    $panic(new $String("cannot internalize js.Object, use *js.Object instead"));
  }
  var timePkg = $packages["time"];
  if (timePkg !== undefined && t === timePkg.Time) {
    if (!(v !== null && v !== undefined && v.constructor === Date)) {
      $panic(new $String("cannot internalize time.Time from " + typeof v + ", must be Date"));
    }
    return timePkg.Unix(new $Int64(0, 0), new $Int64(0, v.getTime() * 1000000));
  }
  switch (t.kind) {
  case $kindBool:
    return !!v;
  case $kindInt:
    return parseInt(v);
  case $kindInt8:
    return parseInt(v) << 24 >> 24;
  case $kindInt16:
    return parseInt(v) << 16 >> 16;
  case $kindInt32:
    return parseInt(v) >> 0;
  case $kindUint:
    return parseInt(v);
  case $kindUint8:
    return parseInt(v) << 24 >>> 24;
  case $kindUint16:
    return parseInt(v) << 16 >>> 16;
  case $kindUint32:
  case $kindUintptr:
    return parseInt(v) >>> 0;
  case $kindInt64:
  case $kindUint64:
    return new t(0, v);
  case $kindFloat32:
  case $kindFloat64:
    return parseFloat(v);
  case $kindArray:
    if (v.length !== t.len) {
      $throwRuntimeError("got array with wrong size from JavaScript native");
    }
    return $mapArray(v, function(e) { return $internalize(e, t.elem); });
  case $kindFunc:
    return function() {
      var args = [];
      for (var i = 0; i < t.params.length; i++) {
        if (t.variadic && i === t.params.length - 1) {
          var vt = t.params[i].elem, varargs = arguments[i];
          for (var j = 0; j < varargs.$length; j++) {
            args.push($externalize(varargs.$array[varargs.$offset + j], vt));
          }
          break;
        }
        args.push($externalize(arguments[i], t.params[i]));
      }
      var result = v.apply(recv, args);
      switch (t.results.length) {
      case 0:
        return;
      case 1:
        return $internalize(result, t.results[0]);
      default:
        for (var i = 0; i < t.results.length; i++) {
          result[i] = $internalize(result[i], t.results[i]);
        }
        return result;
      }
    };
  case $kindInterface:
    if (t.methods.length !== 0) {
      $panic(new $String("cannot internalize " + t.string));
    }
    if (v === null) {
      return $ifaceNil;
    }
    if (v === undefined) {
      return new $jsObjectPtr(undefined);
    }
    switch (v.constructor) {
    case Int8Array:
      return new ($sliceType($Int8))(v);
    case Int16Array:
      return new ($sliceType($Int16))(v);
    case Int32Array:
      return new ($sliceType($Int))(v);
    case Uint8Array:
      return new ($sliceType($Uint8))(v);
    case Uint16Array:
      return new ($sliceType($Uint16))(v);
    case Uint32Array:
      return new ($sliceType($Uint))(v);
    case Float32Array:
      return new ($sliceType($Float32))(v);
    case Float64Array:
      return new ($sliceType($Float64))(v);
    case Array:
      return $internalize(v, $sliceType($emptyInterface));
    case Boolean:
      return new $Bool(!!v);
    case Date:
      if (timePkg === undefined) {
        /* time package is not present, internalize as &js.Object{Date} so it can be externalized into original Date. */
        return new $jsObjectPtr(v);
      }
      return new timePkg.Time($internalize(v, timePkg.Time));
    case Function:
      var funcType = $funcType([$sliceType($emptyInterface)], [$jsObjectPtr], true);
      return new funcType($internalize(v, funcType));
    case Number:
      return new $Float64(parseFloat(v));
    case String:
      return new $String($internalize(v, $String));
    default:
      if ($global.Node && v instanceof $global.Node) {
        return new $jsObjectPtr(v);
      }
      var mapType = $mapType($String, $emptyInterface);
      return new mapType($internalize(v, mapType));
    }
  case $kindMap:
    var m = {};
    var keys = $keys(v);
    for (var i = 0; i < keys.length; i++) {
      var k = $internalize(keys[i], t.key);
      m[t.key.keyFor(k)] = { k: k, v: $internalize(v[keys[i]], t.elem) };
    }
    return m;
  case $kindPtr:
    if (t.elem.kind === $kindStruct) {
      return $internalize(v, t.elem);
    }
  case $kindSlice:
    return new t($mapArray(v, function(e) { return $internalize(e, t.elem); }));
  case $kindString:
    v = String(v);
    if (v.search(/^[\x00-\x7F]*$/) !== -1) {
      return v;
    }
    var s = "";
    var i = 0;
    while (i < v.length) {
      var h = v.charCodeAt(i);
      if (0xD800 <= h && h <= 0xDBFF) {
        var l = v.charCodeAt(i + 1);
        var c = (h - 0xD800) * 0x400 + l - 0xDC00 + 0x10000;
        s += $encodeRune(c);
        i += 2;
        continue;
      }
      s += $encodeRune(h);
      i++;
    }
    return s;
  case $kindStruct:
    var noJsObject = {};
    var searchJsObject = function(t) {
      if (t === $jsObjectPtr) {
        return v;
      }
      if (t === $jsObjectPtr.elem) {
        $panic(new $String("cannot internalize js.Object, use *js.Object instead"));
      }
      switch (t.kind) {
      case $kindPtr:
        return searchJsObject(t.elem);
      case $kindStruct:
        var f = t.fields[0];
        var o = searchJsObject(f.typ);
        if (o !== noJsObject) {
          var n = new t.ptr();
          n[f.prop] = o;
          return n;
        }
        return noJsObject;
      default:
        return noJsObject;
      }
    };
    var o = searchJsObject(t);
    if (o !== noJsObject) {
      return o;
    }
  }
  $panic(new $String("cannot internalize " + t.string));
};

$packages["github.com/gopherjs/gopherjs/js"] = (function() {
	var $pkg = {}, $init, Object, Error, sliceType, ptrType, ptrType$1, init;
	Object = $pkg.Object = $newType(0, $kindStruct, "js.Object", "Object", "github.com/gopherjs/gopherjs/js", function(object_) {
		this.$val = this;
		if (arguments.length === 0) {
			this.object = null;
			return;
		}
		this.object = object_;
	});
	Error = $pkg.Error = $newType(0, $kindStruct, "js.Error", "Error", "github.com/gopherjs/gopherjs/js", function(Object_) {
		this.$val = this;
		if (arguments.length === 0) {
			this.Object = null;
			return;
		}
		this.Object = Object_;
	});
	sliceType = $sliceType($emptyInterface);
	ptrType = $ptrType(Object);
	ptrType$1 = $ptrType(Error);
	Object.ptr.prototype.Get = function(key) {
		var $ptr, key, o;
		o = this;
		return o.object[$externalize(key, $String)];
	};
	Object.prototype.Get = function(key) { return this.$val.Get(key); };
	Object.ptr.prototype.Set = function(key, value) {
		var $ptr, key, o, value;
		o = this;
		o.object[$externalize(key, $String)] = $externalize(value, $emptyInterface);
	};
	Object.prototype.Set = function(key, value) { return this.$val.Set(key, value); };
	Object.ptr.prototype.Delete = function(key) {
		var $ptr, key, o;
		o = this;
		delete o.object[$externalize(key, $String)];
	};
	Object.prototype.Delete = function(key) { return this.$val.Delete(key); };
	Object.ptr.prototype.Length = function() {
		var $ptr, o;
		o = this;
		return $parseInt(o.object.length);
	};
	Object.prototype.Length = function() { return this.$val.Length(); };
	Object.ptr.prototype.Index = function(i) {
		var $ptr, i, o;
		o = this;
		return o.object[i];
	};
	Object.prototype.Index = function(i) { return this.$val.Index(i); };
	Object.ptr.prototype.SetIndex = function(i, value) {
		var $ptr, i, o, value;
		o = this;
		o.object[i] = $externalize(value, $emptyInterface);
	};
	Object.prototype.SetIndex = function(i, value) { return this.$val.SetIndex(i, value); };
	Object.ptr.prototype.Call = function(name, args) {
		var $ptr, args, name, o, obj;
		o = this;
		return (obj = o.object, obj[$externalize(name, $String)].apply(obj, $externalize(args, sliceType)));
	};
	Object.prototype.Call = function(name, args) { return this.$val.Call(name, args); };
	Object.ptr.prototype.Invoke = function(args) {
		var $ptr, args, o;
		o = this;
		return o.object.apply(undefined, $externalize(args, sliceType));
	};
	Object.prototype.Invoke = function(args) { return this.$val.Invoke(args); };
	Object.ptr.prototype.New = function(args) {
		var $ptr, args, o;
		o = this;
		return new ($global.Function.prototype.bind.apply(o.object, [undefined].concat($externalize(args, sliceType))));
	};
	Object.prototype.New = function(args) { return this.$val.New(args); };
	Object.ptr.prototype.Bool = function() {
		var $ptr, o;
		o = this;
		return !!(o.object);
	};
	Object.prototype.Bool = function() { return this.$val.Bool(); };
	Object.ptr.prototype.String = function() {
		var $ptr, o;
		o = this;
		return $internalize(o.object, $String);
	};
	Object.prototype.String = function() { return this.$val.String(); };
	Object.ptr.prototype.Int = function() {
		var $ptr, o;
		o = this;
		return $parseInt(o.object) >> 0;
	};
	Object.prototype.Int = function() { return this.$val.Int(); };
	Object.ptr.prototype.Int64 = function() {
		var $ptr, o;
		o = this;
		return $internalize(o.object, $Int64);
	};
	Object.prototype.Int64 = function() { return this.$val.Int64(); };
	Object.ptr.prototype.Uint64 = function() {
		var $ptr, o;
		o = this;
		return $internalize(o.object, $Uint64);
	};
	Object.prototype.Uint64 = function() { return this.$val.Uint64(); };
	Object.ptr.prototype.Float = function() {
		var $ptr, o;
		o = this;
		return $parseFloat(o.object);
	};
	Object.prototype.Float = function() { return this.$val.Float(); };
	Object.ptr.prototype.Interface = function() {
		var $ptr, o;
		o = this;
		return $internalize(o.object, $emptyInterface);
	};
	Object.prototype.Interface = function() { return this.$val.Interface(); };
	Object.ptr.prototype.Unsafe = function() {
		var $ptr, o;
		o = this;
		return o.object;
	};
	Object.prototype.Unsafe = function() { return this.$val.Unsafe(); };
	Error.ptr.prototype.Error = function() {
		var $ptr, err;
		err = this;
		return "JavaScript error: " + $internalize(err.Object.message, $String);
	};
	Error.prototype.Error = function() { return this.$val.Error(); };
	Error.ptr.prototype.Stack = function() {
		var $ptr, err;
		err = this;
		return $internalize(err.Object.stack, $String);
	};
	Error.prototype.Stack = function() { return this.$val.Stack(); };
	init = function() {
		var $ptr, e;
		e = new Error.ptr(null);
	};
	ptrType.methods = [{prop: "Get", name: "Get", pkg: "", typ: $funcType([$String], [ptrType], false)}, {prop: "Set", name: "Set", pkg: "", typ: $funcType([$String, $emptyInterface], [], false)}, {prop: "Delete", name: "Delete", pkg: "", typ: $funcType([$String], [], false)}, {prop: "Length", name: "Length", pkg: "", typ: $funcType([], [$Int], false)}, {prop: "Index", name: "Index", pkg: "", typ: $funcType([$Int], [ptrType], false)}, {prop: "SetIndex", name: "SetIndex", pkg: "", typ: $funcType([$Int, $emptyInterface], [], false)}, {prop: "Call", name: "Call", pkg: "", typ: $funcType([$String, sliceType], [ptrType], true)}, {prop: "Invoke", name: "Invoke", pkg: "", typ: $funcType([sliceType], [ptrType], true)}, {prop: "New", name: "New", pkg: "", typ: $funcType([sliceType], [ptrType], true)}, {prop: "Bool", name: "Bool", pkg: "", typ: $funcType([], [$Bool], false)}, {prop: "String", name: "String", pkg: "", typ: $funcType([], [$String], false)}, {prop: "Int", name: "Int", pkg: "", typ: $funcType([], [$Int], false)}, {prop: "Int64", name: "Int64", pkg: "", typ: $funcType([], [$Int64], false)}, {prop: "Uint64", name: "Uint64", pkg: "", typ: $funcType([], [$Uint64], false)}, {prop: "Float", name: "Float", pkg: "", typ: $funcType([], [$Float64], false)}, {prop: "Interface", name: "Interface", pkg: "", typ: $funcType([], [$emptyInterface], false)}, {prop: "Unsafe", name: "Unsafe", pkg: "", typ: $funcType([], [$Uintptr], false)}];
	ptrType$1.methods = [{prop: "Error", name: "Error", pkg: "", typ: $funcType([], [$String], false)}, {prop: "Stack", name: "Stack", pkg: "", typ: $funcType([], [$String], false)}];
	Object.init([{prop: "object", name: "object", pkg: "github.com/gopherjs/gopherjs/js", typ: ptrType, tag: ""}]);
	Error.init([{prop: "Object", name: "", pkg: "", typ: ptrType, tag: ""}]);
	$init = function() {
		$pkg.$init = function() {};
		/* */ var $f, $c = false, $s = 0, $r; if (this !== undefined && this.$blk !== undefined) { $f = this; $c = true; $s = $f.$s; $r = $f.$r; } s: while (true) { switch ($s) { case 0:
		init();
		/* */ } return; } if ($f === undefined) { $f = { $blk: $init }; } $f.$s = $s; $f.$r = $r; return $f;
	};
	$pkg.$init = $init;
	return $pkg;
})();
$packages["runtime"] = (function() {
	var $pkg = {}, $init, js, TypeAssertionError, errorString, ptrType$5, init;
	js = $packages["github.com/gopherjs/gopherjs/js"];
	TypeAssertionError = $pkg.TypeAssertionError = $newType(0, $kindStruct, "runtime.TypeAssertionError", "TypeAssertionError", "runtime", function(interfaceString_, concreteString_, assertedString_, missingMethod_) {
		this.$val = this;
		if (arguments.length === 0) {
			this.interfaceString = "";
			this.concreteString = "";
			this.assertedString = "";
			this.missingMethod = "";
			return;
		}
		this.interfaceString = interfaceString_;
		this.concreteString = concreteString_;
		this.assertedString = assertedString_;
		this.missingMethod = missingMethod_;
	});
	errorString = $pkg.errorString = $newType(8, $kindString, "runtime.errorString", "errorString", "runtime", null);
	ptrType$5 = $ptrType(TypeAssertionError);
	init = function() {
		var $ptr, e, jsPkg;
		jsPkg = $packages[$externalize("github.com/gopherjs/gopherjs/js", $String)];
		$jsObjectPtr = jsPkg.Object.ptr;
		$jsErrorPtr = jsPkg.Error.ptr;
		$throwRuntimeError = (function(msg) {
			var $ptr, msg;
			$panic(new errorString(msg));
		});
		e = $ifaceNil;
		e = new TypeAssertionError.ptr("", "", "", "");
	};
	TypeAssertionError.ptr.prototype.RuntimeError = function() {
		var $ptr;
	};
	TypeAssertionError.prototype.RuntimeError = function() { return this.$val.RuntimeError(); };
	TypeAssertionError.ptr.prototype.Error = function() {
		var $ptr, e, inter;
		e = this;
		inter = e.interfaceString;
		if (inter === "") {
			inter = "interface";
		}
		if (e.concreteString === "") {
			return "interface conversion: " + inter + " is nil, not " + e.assertedString;
		}
		if (e.missingMethod === "") {
			return "interface conversion: " + inter + " is " + e.concreteString + ", not " + e.assertedString;
		}
		return "interface conversion: " + e.concreteString + " is not " + e.assertedString + ": missing method " + e.missingMethod;
	};
	TypeAssertionError.prototype.Error = function() { return this.$val.Error(); };
	errorString.prototype.RuntimeError = function() {
		var $ptr, e;
		e = this.$val;
	};
	$ptrType(errorString).prototype.RuntimeError = function() { return new errorString(this.$get()).RuntimeError(); };
	errorString.prototype.Error = function() {
		var $ptr, e;
		e = this.$val;
		return "runtime error: " + e;
	};
	$ptrType(errorString).prototype.Error = function() { return new errorString(this.$get()).Error(); };
	ptrType$5.methods = [{prop: "RuntimeError", name: "RuntimeError", pkg: "", typ: $funcType([], [], false)}, {prop: "Error", name: "Error", pkg: "", typ: $funcType([], [$String], false)}];
	errorString.methods = [{prop: "RuntimeError", name: "RuntimeError", pkg: "", typ: $funcType([], [], false)}, {prop: "Error", name: "Error", pkg: "", typ: $funcType([], [$String], false)}];
	TypeAssertionError.init([{prop: "interfaceString", name: "interfaceString", pkg: "runtime", typ: $String, tag: ""}, {prop: "concreteString", name: "concreteString", pkg: "runtime", typ: $String, tag: ""}, {prop: "assertedString", name: "assertedString", pkg: "runtime", typ: $String, tag: ""}, {prop: "missingMethod", name: "missingMethod", pkg: "runtime", typ: $String, tag: ""}]);
	$init = function() {
		$pkg.$init = function() {};
		/* */ var $f, $c = false, $s = 0, $r; if (this !== undefined && this.$blk !== undefined) { $f = this; $c = true; $s = $f.$s; $r = $f.$r; } s: while (true) { switch ($s) { case 0:
		$r = js.$init(); /* */ $s = 1; case 1: if($c) { $c = false; $r = $r.$blk(); } if ($r && $r.$blk !== undefined) { break s; }
		init();
		/* */ } return; } if ($f === undefined) { $f = { $blk: $init }; } $f.$s = $s; $f.$r = $r; return $f;
	};
	$pkg.$init = $init;
	return $pkg;
})();
$packages["errors"] = (function() {
	var $pkg = {}, $init, errorString, ptrType, New;
	errorString = $pkg.errorString = $newType(0, $kindStruct, "errors.errorString", "errorString", "errors", function(s_) {
		this.$val = this;
		if (arguments.length === 0) {
			this.s = "";
			return;
		}
		this.s = s_;
	});
	ptrType = $ptrType(errorString);
	New = function(text) {
		var $ptr, text;
		return new errorString.ptr(text);
	};
	$pkg.New = New;
	errorString.ptr.prototype.Error = function() {
		var $ptr, e;
		e = this;
		return e.s;
	};
	errorString.prototype.Error = function() { return this.$val.Error(); };
	ptrType.methods = [{prop: "Error", name: "Error", pkg: "", typ: $funcType([], [$String], false)}];
	errorString.init([{prop: "s", name: "s", pkg: "errors", typ: $String, tag: ""}]);
	$init = function() {
		$pkg.$init = function() {};
		/* */ var $f, $c = false, $s = 0, $r; if (this !== undefined && this.$blk !== undefined) { $f = this; $c = true; $s = $f.$s; $r = $f.$r; } s: while (true) { switch ($s) { case 0:
		/* */ } return; } if ($f === undefined) { $f = { $blk: $init }; } $f.$s = $s; $f.$r = $r; return $f;
	};
	$pkg.$init = $init;
	return $pkg;
})();
$packages["github.com/gopherjs/webgl"] = (function() {
	var $pkg = {}, $init, errors, js, ContextAttributes, Context, ptrType, ptrType$1, mapType, ptrType$2, sliceType, sliceType$1, sliceType$2, DefaultAttributes, NewContext;
	errors = $packages["errors"];
	js = $packages["github.com/gopherjs/gopherjs/js"];
	ContextAttributes = $pkg.ContextAttributes = $newType(0, $kindStruct, "webgl.ContextAttributes", "ContextAttributes", "github.com/gopherjs/webgl", function(Alpha_, Depth_, Stencil_, Antialias_, PremultipliedAlpha_, PreserveDrawingBuffer_) {
		this.$val = this;
		if (arguments.length === 0) {
			this.Alpha = false;
			this.Depth = false;
			this.Stencil = false;
			this.Antialias = false;
			this.PremultipliedAlpha = false;
			this.PreserveDrawingBuffer = false;
			return;
		}
		this.Alpha = Alpha_;
		this.Depth = Depth_;
		this.Stencil = Stencil_;
		this.Antialias = Antialias_;
		this.PremultipliedAlpha = PremultipliedAlpha_;
		this.PreserveDrawingBuffer = PreserveDrawingBuffer_;
	});
	Context = $pkg.Context = $newType(0, $kindStruct, "webgl.Context", "Context", "github.com/gopherjs/webgl", function(Object_, ARRAY_BUFFER_, ARRAY_BUFFER_BINDING_, ATTACHED_SHADERS_, BACK_, BLEND_, BLEND_COLOR_, BLEND_DST_ALPHA_, BLEND_DST_RGB_, BLEND_EQUATION_, BLEND_EQUATION_ALPHA_, BLEND_EQUATION_RGB_, BLEND_SRC_ALPHA_, BLEND_SRC_RGB_, BLUE_BITS_, BOOL_, BOOL_VEC2_, BOOL_VEC3_, BOOL_VEC4_, BROWSER_DEFAULT_WEBGL_, BUFFER_SIZE_, BUFFER_USAGE_, BYTE_, CCW_, CLAMP_TO_EDGE_, COLOR_ATTACHMENT0_, COLOR_BUFFER_BIT_, COLOR_CLEAR_VALUE_, COLOR_WRITEMASK_, COMPILE_STATUS_, COMPRESSED_TEXTURE_FORMATS_, CONSTANT_ALPHA_, CONSTANT_COLOR_, CONTEXT_LOST_WEBGL_, CULL_FACE_, CULL_FACE_MODE_, CURRENT_PROGRAM_, CURRENT_VERTEX_ATTRIB_, CW_, DECR_, DECR_WRAP_, DELETE_STATUS_, DEPTH_ATTACHMENT_, DEPTH_BITS_, DEPTH_BUFFER_BIT_, DEPTH_CLEAR_VALUE_, DEPTH_COMPONENT_, DEPTH_COMPONENT16_, DEPTH_FUNC_, DEPTH_RANGE_, DEPTH_STENCIL_, DEPTH_STENCIL_ATTACHMENT_, DEPTH_TEST_, DEPTH_WRITEMASK_, DITHER_, DONT_CARE_, DST_ALPHA_, DST_COLOR_, DYNAMIC_DRAW_, ELEMENT_ARRAY_BUFFER_, ELEMENT_ARRAY_BUFFER_BINDING_, EQUAL_, FASTEST_, FLOAT_, FLOAT_MAT2_, FLOAT_MAT3_, FLOAT_MAT4_, FLOAT_VEC2_, FLOAT_VEC3_, FLOAT_VEC4_, FRAGMENT_SHADER_, FRAMEBUFFER_, FRAMEBUFFER_ATTACHMENT_OBJECT_NAME_, FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE_, FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE_, FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL_, FRAMEBUFFER_BINDING_, FRAMEBUFFER_COMPLETE_, FRAMEBUFFER_INCOMPLETE_ATTACHMENT_, FRAMEBUFFER_INCOMPLETE_DIMENSIONS_, FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT_, FRAMEBUFFER_UNSUPPORTED_, FRONT_, FRONT_AND_BACK_, FRONT_FACE_, FUNC_ADD_, FUNC_REVERSE_SUBTRACT_, FUNC_SUBTRACT_, GENERATE_MIPMAP_HINT_, GEQUAL_, GREATER_, GREEN_BITS_, HIGH_FLOAT_, HIGH_INT_, INCR_, INCR_WRAP_, INFO_LOG_LENGTH_, INT_, INT_VEC2_, INT_VEC3_, INT_VEC4_, INVALID_ENUM_, INVALID_FRAMEBUFFER_OPERATION_, INVALID_OPERATION_, INVALID_VALUE_, INVERT_, KEEP_, LEQUAL_, LESS_, LINEAR_, LINEAR_MIPMAP_LINEAR_, LINEAR_MIPMAP_NEAREST_, LINES_, LINE_LOOP_, LINE_STRIP_, LINE_WIDTH_, LINK_STATUS_, LOW_FLOAT_, LOW_INT_, LUMINANCE_, LUMINANCE_ALPHA_, MAX_COMBINED_TEXTURE_IMAGE_UNITS_, MAX_CUBE_MAP_TEXTURE_SIZE_, MAX_FRAGMENT_UNIFORM_VECTORS_, MAX_RENDERBUFFER_SIZE_, MAX_TEXTURE_IMAGE_UNITS_, MAX_TEXTURE_SIZE_, MAX_VARYING_VECTORS_, MAX_VERTEX_ATTRIBS_, MAX_VERTEX_TEXTURE_IMAGE_UNITS_, MAX_VERTEX_UNIFORM_VECTORS_, MAX_VIEWPORT_DIMS_, MEDIUM_FLOAT_, MEDIUM_INT_, MIRRORED_REPEAT_, NEAREST_, NEAREST_MIPMAP_LINEAR_, NEAREST_MIPMAP_NEAREST_, NEVER_, NICEST_, NONE_, NOTEQUAL_, NO_ERROR_, NUM_COMPRESSED_TEXTURE_FORMATS_, ONE_, ONE_MINUS_CONSTANT_ALPHA_, ONE_MINUS_CONSTANT_COLOR_, ONE_MINUS_DST_ALPHA_, ONE_MINUS_DST_COLOR_, ONE_MINUS_SRC_ALPHA_, ONE_MINUS_SRC_COLOR_, OUT_OF_MEMORY_, PACK_ALIGNMENT_, POINTS_, POLYGON_OFFSET_FACTOR_, POLYGON_OFFSET_FILL_, POLYGON_OFFSET_UNITS_, RED_BITS_, RENDERBUFFER_, RENDERBUFFER_ALPHA_SIZE_, RENDERBUFFER_BINDING_, RENDERBUFFER_BLUE_SIZE_, RENDERBUFFER_DEPTH_SIZE_, RENDERBUFFER_GREEN_SIZE_, RENDERBUFFER_HEIGHT_, RENDERBUFFER_INTERNAL_FORMAT_, RENDERBUFFER_RED_SIZE_, RENDERBUFFER_STENCIL_SIZE_, RENDERBUFFER_WIDTH_, RENDERER_, REPEAT_, REPLACE_, RGB_, RGB5_A1_, RGB565_, RGBA_, RGBA4_, SAMPLER_2D_, SAMPLER_CUBE_, SAMPLES_, SAMPLE_ALPHA_TO_COVERAGE_, SAMPLE_BUFFERS_, SAMPLE_COVERAGE_, SAMPLE_COVERAGE_INVERT_, SAMPLE_COVERAGE_VALUE_, SCISSOR_BOX_, SCISSOR_TEST_, SHADER_COMPILER_, SHADER_SOURCE_LENGTH_, SHADER_TYPE_, SHADING_LANGUAGE_VERSION_, SHORT_, SRC_ALPHA_, SRC_ALPHA_SATURATE_, SRC_COLOR_, STATIC_DRAW_, STENCIL_ATTACHMENT_, STENCIL_BACK_FAIL_, STENCIL_BACK_FUNC_, STENCIL_BACK_PASS_DEPTH_FAIL_, STENCIL_BACK_PASS_DEPTH_PASS_, STENCIL_BACK_REF_, STENCIL_BACK_VALUE_MASK_, STENCIL_BACK_WRITEMASK_, STENCIL_BITS_, STENCIL_BUFFER_BIT_, STENCIL_CLEAR_VALUE_, STENCIL_FAIL_, STENCIL_FUNC_, STENCIL_INDEX_, STENCIL_INDEX8_, STENCIL_PASS_DEPTH_FAIL_, STENCIL_PASS_DEPTH_PASS_, STENCIL_REF_, STENCIL_TEST_, STENCIL_VALUE_MASK_, STENCIL_WRITEMASK_, STREAM_DRAW_, SUBPIXEL_BITS_, TEXTURE_, TEXTURE0_, TEXTURE1_, TEXTURE2_, TEXTURE3_, TEXTURE4_, TEXTURE5_, TEXTURE6_, TEXTURE7_, TEXTURE8_, TEXTURE9_, TEXTURE10_, TEXTURE11_, TEXTURE12_, TEXTURE13_, TEXTURE14_, TEXTURE15_, TEXTURE16_, TEXTURE17_, TEXTURE18_, TEXTURE19_, TEXTURE20_, TEXTURE21_, TEXTURE22_, TEXTURE23_, TEXTURE24_, TEXTURE25_, TEXTURE26_, TEXTURE27_, TEXTURE28_, TEXTURE29_, TEXTURE30_, TEXTURE31_, TEXTURE_2D_, TEXTURE_BINDING_2D_, TEXTURE_BINDING_CUBE_MAP_, TEXTURE_CUBE_MAP_, TEXTURE_CUBE_MAP_NEGATIVE_X_, TEXTURE_CUBE_MAP_NEGATIVE_Y_, TEXTURE_CUBE_MAP_NEGATIVE_Z_, TEXTURE_CUBE_MAP_POSITIVE_X_, TEXTURE_CUBE_MAP_POSITIVE_Y_, TEXTURE_CUBE_MAP_POSITIVE_Z_, TEXTURE_MAG_FILTER_, TEXTURE_MIN_FILTER_, TEXTURE_WRAP_S_, TEXTURE_WRAP_T_, TRIANGLES_, TRIANGLE_FAN_, TRIANGLE_STRIP_, UNPACK_ALIGNMENT_, UNPACK_COLORSPACE_CONVERSION_WEBGL_, UNPACK_FLIP_Y_WEBGL_, UNPACK_PREMULTIPLY_ALPHA_WEBGL_, UNSIGNED_BYTE_, UNSIGNED_INT_, UNSIGNED_SHORT_, UNSIGNED_SHORT_4_4_4_4_, UNSIGNED_SHORT_5_5_5_1_, UNSIGNED_SHORT_5_6_5_, VALIDATE_STATUS_, VENDOR_, VERSION_, VERTEX_ATTRIB_ARRAY_BUFFER_BINDING_, VERTEX_ATTRIB_ARRAY_ENABLED_, VERTEX_ATTRIB_ARRAY_NORMALIZED_, VERTEX_ATTRIB_ARRAY_POINTER_, VERTEX_ATTRIB_ARRAY_SIZE_, VERTEX_ATTRIB_ARRAY_STRIDE_, VERTEX_ATTRIB_ARRAY_TYPE_, VERTEX_SHADER_, VIEWPORT_, ZERO_) {
		this.$val = this;
		if (arguments.length === 0) {
			this.Object = null;
			this.ARRAY_BUFFER = 0;
			this.ARRAY_BUFFER_BINDING = 0;
			this.ATTACHED_SHADERS = 0;
			this.BACK = 0;
			this.BLEND = 0;
			this.BLEND_COLOR = 0;
			this.BLEND_DST_ALPHA = 0;
			this.BLEND_DST_RGB = 0;
			this.BLEND_EQUATION = 0;
			this.BLEND_EQUATION_ALPHA = 0;
			this.BLEND_EQUATION_RGB = 0;
			this.BLEND_SRC_ALPHA = 0;
			this.BLEND_SRC_RGB = 0;
			this.BLUE_BITS = 0;
			this.BOOL = 0;
			this.BOOL_VEC2 = 0;
			this.BOOL_VEC3 = 0;
			this.BOOL_VEC4 = 0;
			this.BROWSER_DEFAULT_WEBGL = 0;
			this.BUFFER_SIZE = 0;
			this.BUFFER_USAGE = 0;
			this.BYTE = 0;
			this.CCW = 0;
			this.CLAMP_TO_EDGE = 0;
			this.COLOR_ATTACHMENT0 = 0;
			this.COLOR_BUFFER_BIT = 0;
			this.COLOR_CLEAR_VALUE = 0;
			this.COLOR_WRITEMASK = 0;
			this.COMPILE_STATUS = 0;
			this.COMPRESSED_TEXTURE_FORMATS = 0;
			this.CONSTANT_ALPHA = 0;
			this.CONSTANT_COLOR = 0;
			this.CONTEXT_LOST_WEBGL = 0;
			this.CULL_FACE = 0;
			this.CULL_FACE_MODE = 0;
			this.CURRENT_PROGRAM = 0;
			this.CURRENT_VERTEX_ATTRIB = 0;
			this.CW = 0;
			this.DECR = 0;
			this.DECR_WRAP = 0;
			this.DELETE_STATUS = 0;
			this.DEPTH_ATTACHMENT = 0;
			this.DEPTH_BITS = 0;
			this.DEPTH_BUFFER_BIT = 0;
			this.DEPTH_CLEAR_VALUE = 0;
			this.DEPTH_COMPONENT = 0;
			this.DEPTH_COMPONENT16 = 0;
			this.DEPTH_FUNC = 0;
			this.DEPTH_RANGE = 0;
			this.DEPTH_STENCIL = 0;
			this.DEPTH_STENCIL_ATTACHMENT = 0;
			this.DEPTH_TEST = 0;
			this.DEPTH_WRITEMASK = 0;
			this.DITHER = 0;
			this.DONT_CARE = 0;
			this.DST_ALPHA = 0;
			this.DST_COLOR = 0;
			this.DYNAMIC_DRAW = 0;
			this.ELEMENT_ARRAY_BUFFER = 0;
			this.ELEMENT_ARRAY_BUFFER_BINDING = 0;
			this.EQUAL = 0;
			this.FASTEST = 0;
			this.FLOAT = 0;
			this.FLOAT_MAT2 = 0;
			this.FLOAT_MAT3 = 0;
			this.FLOAT_MAT4 = 0;
			this.FLOAT_VEC2 = 0;
			this.FLOAT_VEC3 = 0;
			this.FLOAT_VEC4 = 0;
			this.FRAGMENT_SHADER = 0;
			this.FRAMEBUFFER = 0;
			this.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME = 0;
			this.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE = 0;
			this.FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE = 0;
			this.FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL = 0;
			this.FRAMEBUFFER_BINDING = 0;
			this.FRAMEBUFFER_COMPLETE = 0;
			this.FRAMEBUFFER_INCOMPLETE_ATTACHMENT = 0;
			this.FRAMEBUFFER_INCOMPLETE_DIMENSIONS = 0;
			this.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT = 0;
			this.FRAMEBUFFER_UNSUPPORTED = 0;
			this.FRONT = 0;
			this.FRONT_AND_BACK = 0;
			this.FRONT_FACE = 0;
			this.FUNC_ADD = 0;
			this.FUNC_REVERSE_SUBTRACT = 0;
			this.FUNC_SUBTRACT = 0;
			this.GENERATE_MIPMAP_HINT = 0;
			this.GEQUAL = 0;
			this.GREATER = 0;
			this.GREEN_BITS = 0;
			this.HIGH_FLOAT = 0;
			this.HIGH_INT = 0;
			this.INCR = 0;
			this.INCR_WRAP = 0;
			this.INFO_LOG_LENGTH = 0;
			this.INT = 0;
			this.INT_VEC2 = 0;
			this.INT_VEC3 = 0;
			this.INT_VEC4 = 0;
			this.INVALID_ENUM = 0;
			this.INVALID_FRAMEBUFFER_OPERATION = 0;
			this.INVALID_OPERATION = 0;
			this.INVALID_VALUE = 0;
			this.INVERT = 0;
			this.KEEP = 0;
			this.LEQUAL = 0;
			this.LESS = 0;
			this.LINEAR = 0;
			this.LINEAR_MIPMAP_LINEAR = 0;
			this.LINEAR_MIPMAP_NEAREST = 0;
			this.LINES = 0;
			this.LINE_LOOP = 0;
			this.LINE_STRIP = 0;
			this.LINE_WIDTH = 0;
			this.LINK_STATUS = 0;
			this.LOW_FLOAT = 0;
			this.LOW_INT = 0;
			this.LUMINANCE = 0;
			this.LUMINANCE_ALPHA = 0;
			this.MAX_COMBINED_TEXTURE_IMAGE_UNITS = 0;
			this.MAX_CUBE_MAP_TEXTURE_SIZE = 0;
			this.MAX_FRAGMENT_UNIFORM_VECTORS = 0;
			this.MAX_RENDERBUFFER_SIZE = 0;
			this.MAX_TEXTURE_IMAGE_UNITS = 0;
			this.MAX_TEXTURE_SIZE = 0;
			this.MAX_VARYING_VECTORS = 0;
			this.MAX_VERTEX_ATTRIBS = 0;
			this.MAX_VERTEX_TEXTURE_IMAGE_UNITS = 0;
			this.MAX_VERTEX_UNIFORM_VECTORS = 0;
			this.MAX_VIEWPORT_DIMS = 0;
			this.MEDIUM_FLOAT = 0;
			this.MEDIUM_INT = 0;
			this.MIRRORED_REPEAT = 0;
			this.NEAREST = 0;
			this.NEAREST_MIPMAP_LINEAR = 0;
			this.NEAREST_MIPMAP_NEAREST = 0;
			this.NEVER = 0;
			this.NICEST = 0;
			this.NONE = 0;
			this.NOTEQUAL = 0;
			this.NO_ERROR = 0;
			this.NUM_COMPRESSED_TEXTURE_FORMATS = 0;
			this.ONE = 0;
			this.ONE_MINUS_CONSTANT_ALPHA = 0;
			this.ONE_MINUS_CONSTANT_COLOR = 0;
			this.ONE_MINUS_DST_ALPHA = 0;
			this.ONE_MINUS_DST_COLOR = 0;
			this.ONE_MINUS_SRC_ALPHA = 0;
			this.ONE_MINUS_SRC_COLOR = 0;
			this.OUT_OF_MEMORY = 0;
			this.PACK_ALIGNMENT = 0;
			this.POINTS = 0;
			this.POLYGON_OFFSET_FACTOR = 0;
			this.POLYGON_OFFSET_FILL = 0;
			this.POLYGON_OFFSET_UNITS = 0;
			this.RED_BITS = 0;
			this.RENDERBUFFER = 0;
			this.RENDERBUFFER_ALPHA_SIZE = 0;
			this.RENDERBUFFER_BINDING = 0;
			this.RENDERBUFFER_BLUE_SIZE = 0;
			this.RENDERBUFFER_DEPTH_SIZE = 0;
			this.RENDERBUFFER_GREEN_SIZE = 0;
			this.RENDERBUFFER_HEIGHT = 0;
			this.RENDERBUFFER_INTERNAL_FORMAT = 0;
			this.RENDERBUFFER_RED_SIZE = 0;
			this.RENDERBUFFER_STENCIL_SIZE = 0;
			this.RENDERBUFFER_WIDTH = 0;
			this.RENDERER = 0;
			this.REPEAT = 0;
			this.REPLACE = 0;
			this.RGB = 0;
			this.RGB5_A1 = 0;
			this.RGB565 = 0;
			this.RGBA = 0;
			this.RGBA4 = 0;
			this.SAMPLER_2D = 0;
			this.SAMPLER_CUBE = 0;
			this.SAMPLES = 0;
			this.SAMPLE_ALPHA_TO_COVERAGE = 0;
			this.SAMPLE_BUFFERS = 0;
			this.SAMPLE_COVERAGE = 0;
			this.SAMPLE_COVERAGE_INVERT = 0;
			this.SAMPLE_COVERAGE_VALUE = 0;
			this.SCISSOR_BOX = 0;
			this.SCISSOR_TEST = 0;
			this.SHADER_COMPILER = 0;
			this.SHADER_SOURCE_LENGTH = 0;
			this.SHADER_TYPE = 0;
			this.SHADING_LANGUAGE_VERSION = 0;
			this.SHORT = 0;
			this.SRC_ALPHA = 0;
			this.SRC_ALPHA_SATURATE = 0;
			this.SRC_COLOR = 0;
			this.STATIC_DRAW = 0;
			this.STENCIL_ATTACHMENT = 0;
			this.STENCIL_BACK_FAIL = 0;
			this.STENCIL_BACK_FUNC = 0;
			this.STENCIL_BACK_PASS_DEPTH_FAIL = 0;
			this.STENCIL_BACK_PASS_DEPTH_PASS = 0;
			this.STENCIL_BACK_REF = 0;
			this.STENCIL_BACK_VALUE_MASK = 0;
			this.STENCIL_BACK_WRITEMASK = 0;
			this.STENCIL_BITS = 0;
			this.STENCIL_BUFFER_BIT = 0;
			this.STENCIL_CLEAR_VALUE = 0;
			this.STENCIL_FAIL = 0;
			this.STENCIL_FUNC = 0;
			this.STENCIL_INDEX = 0;
			this.STENCIL_INDEX8 = 0;
			this.STENCIL_PASS_DEPTH_FAIL = 0;
			this.STENCIL_PASS_DEPTH_PASS = 0;
			this.STENCIL_REF = 0;
			this.STENCIL_TEST = 0;
			this.STENCIL_VALUE_MASK = 0;
			this.STENCIL_WRITEMASK = 0;
			this.STREAM_DRAW = 0;
			this.SUBPIXEL_BITS = 0;
			this.TEXTURE = 0;
			this.TEXTURE0 = 0;
			this.TEXTURE1 = 0;
			this.TEXTURE2 = 0;
			this.TEXTURE3 = 0;
			this.TEXTURE4 = 0;
			this.TEXTURE5 = 0;
			this.TEXTURE6 = 0;
			this.TEXTURE7 = 0;
			this.TEXTURE8 = 0;
			this.TEXTURE9 = 0;
			this.TEXTURE10 = 0;
			this.TEXTURE11 = 0;
			this.TEXTURE12 = 0;
			this.TEXTURE13 = 0;
			this.TEXTURE14 = 0;
			this.TEXTURE15 = 0;
			this.TEXTURE16 = 0;
			this.TEXTURE17 = 0;
			this.TEXTURE18 = 0;
			this.TEXTURE19 = 0;
			this.TEXTURE20 = 0;
			this.TEXTURE21 = 0;
			this.TEXTURE22 = 0;
			this.TEXTURE23 = 0;
			this.TEXTURE24 = 0;
			this.TEXTURE25 = 0;
			this.TEXTURE26 = 0;
			this.TEXTURE27 = 0;
			this.TEXTURE28 = 0;
			this.TEXTURE29 = 0;
			this.TEXTURE30 = 0;
			this.TEXTURE31 = 0;
			this.TEXTURE_2D = 0;
			this.TEXTURE_BINDING_2D = 0;
			this.TEXTURE_BINDING_CUBE_MAP = 0;
			this.TEXTURE_CUBE_MAP = 0;
			this.TEXTURE_CUBE_MAP_NEGATIVE_X = 0;
			this.TEXTURE_CUBE_MAP_NEGATIVE_Y = 0;
			this.TEXTURE_CUBE_MAP_NEGATIVE_Z = 0;
			this.TEXTURE_CUBE_MAP_POSITIVE_X = 0;
			this.TEXTURE_CUBE_MAP_POSITIVE_Y = 0;
			this.TEXTURE_CUBE_MAP_POSITIVE_Z = 0;
			this.TEXTURE_MAG_FILTER = 0;
			this.TEXTURE_MIN_FILTER = 0;
			this.TEXTURE_WRAP_S = 0;
			this.TEXTURE_WRAP_T = 0;
			this.TRIANGLES = 0;
			this.TRIANGLE_FAN = 0;
			this.TRIANGLE_STRIP = 0;
			this.UNPACK_ALIGNMENT = 0;
			this.UNPACK_COLORSPACE_CONVERSION_WEBGL = 0;
			this.UNPACK_FLIP_Y_WEBGL = 0;
			this.UNPACK_PREMULTIPLY_ALPHA_WEBGL = 0;
			this.UNSIGNED_BYTE = 0;
			this.UNSIGNED_INT = 0;
			this.UNSIGNED_SHORT = 0;
			this.UNSIGNED_SHORT_4_4_4_4 = 0;
			this.UNSIGNED_SHORT_5_5_5_1 = 0;
			this.UNSIGNED_SHORT_5_6_5 = 0;
			this.VALIDATE_STATUS = 0;
			this.VENDOR = 0;
			this.VERSION = 0;
			this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING = 0;
			this.VERTEX_ATTRIB_ARRAY_ENABLED = 0;
			this.VERTEX_ATTRIB_ARRAY_NORMALIZED = 0;
			this.VERTEX_ATTRIB_ARRAY_POINTER = 0;
			this.VERTEX_ATTRIB_ARRAY_SIZE = 0;
			this.VERTEX_ATTRIB_ARRAY_STRIDE = 0;
			this.VERTEX_ATTRIB_ARRAY_TYPE = 0;
			this.VERTEX_SHADER = 0;
			this.VIEWPORT = 0;
			this.ZERO = 0;
			return;
		}
		this.Object = Object_;
		this.ARRAY_BUFFER = ARRAY_BUFFER_;
		this.ARRAY_BUFFER_BINDING = ARRAY_BUFFER_BINDING_;
		this.ATTACHED_SHADERS = ATTACHED_SHADERS_;
		this.BACK = BACK_;
		this.BLEND = BLEND_;
		this.BLEND_COLOR = BLEND_COLOR_;
		this.BLEND_DST_ALPHA = BLEND_DST_ALPHA_;
		this.BLEND_DST_RGB = BLEND_DST_RGB_;
		this.BLEND_EQUATION = BLEND_EQUATION_;
		this.BLEND_EQUATION_ALPHA = BLEND_EQUATION_ALPHA_;
		this.BLEND_EQUATION_RGB = BLEND_EQUATION_RGB_;
		this.BLEND_SRC_ALPHA = BLEND_SRC_ALPHA_;
		this.BLEND_SRC_RGB = BLEND_SRC_RGB_;
		this.BLUE_BITS = BLUE_BITS_;
		this.BOOL = BOOL_;
		this.BOOL_VEC2 = BOOL_VEC2_;
		this.BOOL_VEC3 = BOOL_VEC3_;
		this.BOOL_VEC4 = BOOL_VEC4_;
		this.BROWSER_DEFAULT_WEBGL = BROWSER_DEFAULT_WEBGL_;
		this.BUFFER_SIZE = BUFFER_SIZE_;
		this.BUFFER_USAGE = BUFFER_USAGE_;
		this.BYTE = BYTE_;
		this.CCW = CCW_;
		this.CLAMP_TO_EDGE = CLAMP_TO_EDGE_;
		this.COLOR_ATTACHMENT0 = COLOR_ATTACHMENT0_;
		this.COLOR_BUFFER_BIT = COLOR_BUFFER_BIT_;
		this.COLOR_CLEAR_VALUE = COLOR_CLEAR_VALUE_;
		this.COLOR_WRITEMASK = COLOR_WRITEMASK_;
		this.COMPILE_STATUS = COMPILE_STATUS_;
		this.COMPRESSED_TEXTURE_FORMATS = COMPRESSED_TEXTURE_FORMATS_;
		this.CONSTANT_ALPHA = CONSTANT_ALPHA_;
		this.CONSTANT_COLOR = CONSTANT_COLOR_;
		this.CONTEXT_LOST_WEBGL = CONTEXT_LOST_WEBGL_;
		this.CULL_FACE = CULL_FACE_;
		this.CULL_FACE_MODE = CULL_FACE_MODE_;
		this.CURRENT_PROGRAM = CURRENT_PROGRAM_;
		this.CURRENT_VERTEX_ATTRIB = CURRENT_VERTEX_ATTRIB_;
		this.CW = CW_;
		this.DECR = DECR_;
		this.DECR_WRAP = DECR_WRAP_;
		this.DELETE_STATUS = DELETE_STATUS_;
		this.DEPTH_ATTACHMENT = DEPTH_ATTACHMENT_;
		this.DEPTH_BITS = DEPTH_BITS_;
		this.DEPTH_BUFFER_BIT = DEPTH_BUFFER_BIT_;
		this.DEPTH_CLEAR_VALUE = DEPTH_CLEAR_VALUE_;
		this.DEPTH_COMPONENT = DEPTH_COMPONENT_;
		this.DEPTH_COMPONENT16 = DEPTH_COMPONENT16_;
		this.DEPTH_FUNC = DEPTH_FUNC_;
		this.DEPTH_RANGE = DEPTH_RANGE_;
		this.DEPTH_STENCIL = DEPTH_STENCIL_;
		this.DEPTH_STENCIL_ATTACHMENT = DEPTH_STENCIL_ATTACHMENT_;
		this.DEPTH_TEST = DEPTH_TEST_;
		this.DEPTH_WRITEMASK = DEPTH_WRITEMASK_;
		this.DITHER = DITHER_;
		this.DONT_CARE = DONT_CARE_;
		this.DST_ALPHA = DST_ALPHA_;
		this.DST_COLOR = DST_COLOR_;
		this.DYNAMIC_DRAW = DYNAMIC_DRAW_;
		this.ELEMENT_ARRAY_BUFFER = ELEMENT_ARRAY_BUFFER_;
		this.ELEMENT_ARRAY_BUFFER_BINDING = ELEMENT_ARRAY_BUFFER_BINDING_;
		this.EQUAL = EQUAL_;
		this.FASTEST = FASTEST_;
		this.FLOAT = FLOAT_;
		this.FLOAT_MAT2 = FLOAT_MAT2_;
		this.FLOAT_MAT3 = FLOAT_MAT3_;
		this.FLOAT_MAT4 = FLOAT_MAT4_;
		this.FLOAT_VEC2 = FLOAT_VEC2_;
		this.FLOAT_VEC3 = FLOAT_VEC3_;
		this.FLOAT_VEC4 = FLOAT_VEC4_;
		this.FRAGMENT_SHADER = FRAGMENT_SHADER_;
		this.FRAMEBUFFER = FRAMEBUFFER_;
		this.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME = FRAMEBUFFER_ATTACHMENT_OBJECT_NAME_;
		this.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE = FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE_;
		this.FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE = FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE_;
		this.FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL = FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL_;
		this.FRAMEBUFFER_BINDING = FRAMEBUFFER_BINDING_;
		this.FRAMEBUFFER_COMPLETE = FRAMEBUFFER_COMPLETE_;
		this.FRAMEBUFFER_INCOMPLETE_ATTACHMENT = FRAMEBUFFER_INCOMPLETE_ATTACHMENT_;
		this.FRAMEBUFFER_INCOMPLETE_DIMENSIONS = FRAMEBUFFER_INCOMPLETE_DIMENSIONS_;
		this.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT = FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT_;
		this.FRAMEBUFFER_UNSUPPORTED = FRAMEBUFFER_UNSUPPORTED_;
		this.FRONT = FRONT_;
		this.FRONT_AND_BACK = FRONT_AND_BACK_;
		this.FRONT_FACE = FRONT_FACE_;
		this.FUNC_ADD = FUNC_ADD_;
		this.FUNC_REVERSE_SUBTRACT = FUNC_REVERSE_SUBTRACT_;
		this.FUNC_SUBTRACT = FUNC_SUBTRACT_;
		this.GENERATE_MIPMAP_HINT = GENERATE_MIPMAP_HINT_;
		this.GEQUAL = GEQUAL_;
		this.GREATER = GREATER_;
		this.GREEN_BITS = GREEN_BITS_;
		this.HIGH_FLOAT = HIGH_FLOAT_;
		this.HIGH_INT = HIGH_INT_;
		this.INCR = INCR_;
		this.INCR_WRAP = INCR_WRAP_;
		this.INFO_LOG_LENGTH = INFO_LOG_LENGTH_;
		this.INT = INT_;
		this.INT_VEC2 = INT_VEC2_;
		this.INT_VEC3 = INT_VEC3_;
		this.INT_VEC4 = INT_VEC4_;
		this.INVALID_ENUM = INVALID_ENUM_;
		this.INVALID_FRAMEBUFFER_OPERATION = INVALID_FRAMEBUFFER_OPERATION_;
		this.INVALID_OPERATION = INVALID_OPERATION_;
		this.INVALID_VALUE = INVALID_VALUE_;
		this.INVERT = INVERT_;
		this.KEEP = KEEP_;
		this.LEQUAL = LEQUAL_;
		this.LESS = LESS_;
		this.LINEAR = LINEAR_;
		this.LINEAR_MIPMAP_LINEAR = LINEAR_MIPMAP_LINEAR_;
		this.LINEAR_MIPMAP_NEAREST = LINEAR_MIPMAP_NEAREST_;
		this.LINES = LINES_;
		this.LINE_LOOP = LINE_LOOP_;
		this.LINE_STRIP = LINE_STRIP_;
		this.LINE_WIDTH = LINE_WIDTH_;
		this.LINK_STATUS = LINK_STATUS_;
		this.LOW_FLOAT = LOW_FLOAT_;
		this.LOW_INT = LOW_INT_;
		this.LUMINANCE = LUMINANCE_;
		this.LUMINANCE_ALPHA = LUMINANCE_ALPHA_;
		this.MAX_COMBINED_TEXTURE_IMAGE_UNITS = MAX_COMBINED_TEXTURE_IMAGE_UNITS_;
		this.MAX_CUBE_MAP_TEXTURE_SIZE = MAX_CUBE_MAP_TEXTURE_SIZE_;
		this.MAX_FRAGMENT_UNIFORM_VECTORS = MAX_FRAGMENT_UNIFORM_VECTORS_;
		this.MAX_RENDERBUFFER_SIZE = MAX_RENDERBUFFER_SIZE_;
		this.MAX_TEXTURE_IMAGE_UNITS = MAX_TEXTURE_IMAGE_UNITS_;
		this.MAX_TEXTURE_SIZE = MAX_TEXTURE_SIZE_;
		this.MAX_VARYING_VECTORS = MAX_VARYING_VECTORS_;
		this.MAX_VERTEX_ATTRIBS = MAX_VERTEX_ATTRIBS_;
		this.MAX_VERTEX_TEXTURE_IMAGE_UNITS = MAX_VERTEX_TEXTURE_IMAGE_UNITS_;
		this.MAX_VERTEX_UNIFORM_VECTORS = MAX_VERTEX_UNIFORM_VECTORS_;
		this.MAX_VIEWPORT_DIMS = MAX_VIEWPORT_DIMS_;
		this.MEDIUM_FLOAT = MEDIUM_FLOAT_;
		this.MEDIUM_INT = MEDIUM_INT_;
		this.MIRRORED_REPEAT = MIRRORED_REPEAT_;
		this.NEAREST = NEAREST_;
		this.NEAREST_MIPMAP_LINEAR = NEAREST_MIPMAP_LINEAR_;
		this.NEAREST_MIPMAP_NEAREST = NEAREST_MIPMAP_NEAREST_;
		this.NEVER = NEVER_;
		this.NICEST = NICEST_;
		this.NONE = NONE_;
		this.NOTEQUAL = NOTEQUAL_;
		this.NO_ERROR = NO_ERROR_;
		this.NUM_COMPRESSED_TEXTURE_FORMATS = NUM_COMPRESSED_TEXTURE_FORMATS_;
		this.ONE = ONE_;
		this.ONE_MINUS_CONSTANT_ALPHA = ONE_MINUS_CONSTANT_ALPHA_;
		this.ONE_MINUS_CONSTANT_COLOR = ONE_MINUS_CONSTANT_COLOR_;
		this.ONE_MINUS_DST_ALPHA = ONE_MINUS_DST_ALPHA_;
		this.ONE_MINUS_DST_COLOR = ONE_MINUS_DST_COLOR_;
		this.ONE_MINUS_SRC_ALPHA = ONE_MINUS_SRC_ALPHA_;
		this.ONE_MINUS_SRC_COLOR = ONE_MINUS_SRC_COLOR_;
		this.OUT_OF_MEMORY = OUT_OF_MEMORY_;
		this.PACK_ALIGNMENT = PACK_ALIGNMENT_;
		this.POINTS = POINTS_;
		this.POLYGON_OFFSET_FACTOR = POLYGON_OFFSET_FACTOR_;
		this.POLYGON_OFFSET_FILL = POLYGON_OFFSET_FILL_;
		this.POLYGON_OFFSET_UNITS = POLYGON_OFFSET_UNITS_;
		this.RED_BITS = RED_BITS_;
		this.RENDERBUFFER = RENDERBUFFER_;
		this.RENDERBUFFER_ALPHA_SIZE = RENDERBUFFER_ALPHA_SIZE_;
		this.RENDERBUFFER_BINDING = RENDERBUFFER_BINDING_;
		this.RENDERBUFFER_BLUE_SIZE = RENDERBUFFER_BLUE_SIZE_;
		this.RENDERBUFFER_DEPTH_SIZE = RENDERBUFFER_DEPTH_SIZE_;
		this.RENDERBUFFER_GREEN_SIZE = RENDERBUFFER_GREEN_SIZE_;
		this.RENDERBUFFER_HEIGHT = RENDERBUFFER_HEIGHT_;
		this.RENDERBUFFER_INTERNAL_FORMAT = RENDERBUFFER_INTERNAL_FORMAT_;
		this.RENDERBUFFER_RED_SIZE = RENDERBUFFER_RED_SIZE_;
		this.RENDERBUFFER_STENCIL_SIZE = RENDERBUFFER_STENCIL_SIZE_;
		this.RENDERBUFFER_WIDTH = RENDERBUFFER_WIDTH_;
		this.RENDERER = RENDERER_;
		this.REPEAT = REPEAT_;
		this.REPLACE = REPLACE_;
		this.RGB = RGB_;
		this.RGB5_A1 = RGB5_A1_;
		this.RGB565 = RGB565_;
		this.RGBA = RGBA_;
		this.RGBA4 = RGBA4_;
		this.SAMPLER_2D = SAMPLER_2D_;
		this.SAMPLER_CUBE = SAMPLER_CUBE_;
		this.SAMPLES = SAMPLES_;
		this.SAMPLE_ALPHA_TO_COVERAGE = SAMPLE_ALPHA_TO_COVERAGE_;
		this.SAMPLE_BUFFERS = SAMPLE_BUFFERS_;
		this.SAMPLE_COVERAGE = SAMPLE_COVERAGE_;
		this.SAMPLE_COVERAGE_INVERT = SAMPLE_COVERAGE_INVERT_;
		this.SAMPLE_COVERAGE_VALUE = SAMPLE_COVERAGE_VALUE_;
		this.SCISSOR_BOX = SCISSOR_BOX_;
		this.SCISSOR_TEST = SCISSOR_TEST_;
		this.SHADER_COMPILER = SHADER_COMPILER_;
		this.SHADER_SOURCE_LENGTH = SHADER_SOURCE_LENGTH_;
		this.SHADER_TYPE = SHADER_TYPE_;
		this.SHADING_LANGUAGE_VERSION = SHADING_LANGUAGE_VERSION_;
		this.SHORT = SHORT_;
		this.SRC_ALPHA = SRC_ALPHA_;
		this.SRC_ALPHA_SATURATE = SRC_ALPHA_SATURATE_;
		this.SRC_COLOR = SRC_COLOR_;
		this.STATIC_DRAW = STATIC_DRAW_;
		this.STENCIL_ATTACHMENT = STENCIL_ATTACHMENT_;
		this.STENCIL_BACK_FAIL = STENCIL_BACK_FAIL_;
		this.STENCIL_BACK_FUNC = STENCIL_BACK_FUNC_;
		this.STENCIL_BACK_PASS_DEPTH_FAIL = STENCIL_BACK_PASS_DEPTH_FAIL_;
		this.STENCIL_BACK_PASS_DEPTH_PASS = STENCIL_BACK_PASS_DEPTH_PASS_;
		this.STENCIL_BACK_REF = STENCIL_BACK_REF_;
		this.STENCIL_BACK_VALUE_MASK = STENCIL_BACK_VALUE_MASK_;
		this.STENCIL_BACK_WRITEMASK = STENCIL_BACK_WRITEMASK_;
		this.STENCIL_BITS = STENCIL_BITS_;
		this.STENCIL_BUFFER_BIT = STENCIL_BUFFER_BIT_;
		this.STENCIL_CLEAR_VALUE = STENCIL_CLEAR_VALUE_;
		this.STENCIL_FAIL = STENCIL_FAIL_;
		this.STENCIL_FUNC = STENCIL_FUNC_;
		this.STENCIL_INDEX = STENCIL_INDEX_;
		this.STENCIL_INDEX8 = STENCIL_INDEX8_;
		this.STENCIL_PASS_DEPTH_FAIL = STENCIL_PASS_DEPTH_FAIL_;
		this.STENCIL_PASS_DEPTH_PASS = STENCIL_PASS_DEPTH_PASS_;
		this.STENCIL_REF = STENCIL_REF_;
		this.STENCIL_TEST = STENCIL_TEST_;
		this.STENCIL_VALUE_MASK = STENCIL_VALUE_MASK_;
		this.STENCIL_WRITEMASK = STENCIL_WRITEMASK_;
		this.STREAM_DRAW = STREAM_DRAW_;
		this.SUBPIXEL_BITS = SUBPIXEL_BITS_;
		this.TEXTURE = TEXTURE_;
		this.TEXTURE0 = TEXTURE0_;
		this.TEXTURE1 = TEXTURE1_;
		this.TEXTURE2 = TEXTURE2_;
		this.TEXTURE3 = TEXTURE3_;
		this.TEXTURE4 = TEXTURE4_;
		this.TEXTURE5 = TEXTURE5_;
		this.TEXTURE6 = TEXTURE6_;
		this.TEXTURE7 = TEXTURE7_;
		this.TEXTURE8 = TEXTURE8_;
		this.TEXTURE9 = TEXTURE9_;
		this.TEXTURE10 = TEXTURE10_;
		this.TEXTURE11 = TEXTURE11_;
		this.TEXTURE12 = TEXTURE12_;
		this.TEXTURE13 = TEXTURE13_;
		this.TEXTURE14 = TEXTURE14_;
		this.TEXTURE15 = TEXTURE15_;
		this.TEXTURE16 = TEXTURE16_;
		this.TEXTURE17 = TEXTURE17_;
		this.TEXTURE18 = TEXTURE18_;
		this.TEXTURE19 = TEXTURE19_;
		this.TEXTURE20 = TEXTURE20_;
		this.TEXTURE21 = TEXTURE21_;
		this.TEXTURE22 = TEXTURE22_;
		this.TEXTURE23 = TEXTURE23_;
		this.TEXTURE24 = TEXTURE24_;
		this.TEXTURE25 = TEXTURE25_;
		this.TEXTURE26 = TEXTURE26_;
		this.TEXTURE27 = TEXTURE27_;
		this.TEXTURE28 = TEXTURE28_;
		this.TEXTURE29 = TEXTURE29_;
		this.TEXTURE30 = TEXTURE30_;
		this.TEXTURE31 = TEXTURE31_;
		this.TEXTURE_2D = TEXTURE_2D_;
		this.TEXTURE_BINDING_2D = TEXTURE_BINDING_2D_;
		this.TEXTURE_BINDING_CUBE_MAP = TEXTURE_BINDING_CUBE_MAP_;
		this.TEXTURE_CUBE_MAP = TEXTURE_CUBE_MAP_;
		this.TEXTURE_CUBE_MAP_NEGATIVE_X = TEXTURE_CUBE_MAP_NEGATIVE_X_;
		this.TEXTURE_CUBE_MAP_NEGATIVE_Y = TEXTURE_CUBE_MAP_NEGATIVE_Y_;
		this.TEXTURE_CUBE_MAP_NEGATIVE_Z = TEXTURE_CUBE_MAP_NEGATIVE_Z_;
		this.TEXTURE_CUBE_MAP_POSITIVE_X = TEXTURE_CUBE_MAP_POSITIVE_X_;
		this.TEXTURE_CUBE_MAP_POSITIVE_Y = TEXTURE_CUBE_MAP_POSITIVE_Y_;
		this.TEXTURE_CUBE_MAP_POSITIVE_Z = TEXTURE_CUBE_MAP_POSITIVE_Z_;
		this.TEXTURE_MAG_FILTER = TEXTURE_MAG_FILTER_;
		this.TEXTURE_MIN_FILTER = TEXTURE_MIN_FILTER_;
		this.TEXTURE_WRAP_S = TEXTURE_WRAP_S_;
		this.TEXTURE_WRAP_T = TEXTURE_WRAP_T_;
		this.TRIANGLES = TRIANGLES_;
		this.TRIANGLE_FAN = TRIANGLE_FAN_;
		this.TRIANGLE_STRIP = TRIANGLE_STRIP_;
		this.UNPACK_ALIGNMENT = UNPACK_ALIGNMENT_;
		this.UNPACK_COLORSPACE_CONVERSION_WEBGL = UNPACK_COLORSPACE_CONVERSION_WEBGL_;
		this.UNPACK_FLIP_Y_WEBGL = UNPACK_FLIP_Y_WEBGL_;
		this.UNPACK_PREMULTIPLY_ALPHA_WEBGL = UNPACK_PREMULTIPLY_ALPHA_WEBGL_;
		this.UNSIGNED_BYTE = UNSIGNED_BYTE_;
		this.UNSIGNED_INT = UNSIGNED_INT_;
		this.UNSIGNED_SHORT = UNSIGNED_SHORT_;
		this.UNSIGNED_SHORT_4_4_4_4 = UNSIGNED_SHORT_4_4_4_4_;
		this.UNSIGNED_SHORT_5_5_5_1 = UNSIGNED_SHORT_5_5_5_1_;
		this.UNSIGNED_SHORT_5_6_5 = UNSIGNED_SHORT_5_6_5_;
		this.VALIDATE_STATUS = VALIDATE_STATUS_;
		this.VENDOR = VENDOR_;
		this.VERSION = VERSION_;
		this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING = VERTEX_ATTRIB_ARRAY_BUFFER_BINDING_;
		this.VERTEX_ATTRIB_ARRAY_ENABLED = VERTEX_ATTRIB_ARRAY_ENABLED_;
		this.VERTEX_ATTRIB_ARRAY_NORMALIZED = VERTEX_ATTRIB_ARRAY_NORMALIZED_;
		this.VERTEX_ATTRIB_ARRAY_POINTER = VERTEX_ATTRIB_ARRAY_POINTER_;
		this.VERTEX_ATTRIB_ARRAY_SIZE = VERTEX_ATTRIB_ARRAY_SIZE_;
		this.VERTEX_ATTRIB_ARRAY_STRIDE = VERTEX_ATTRIB_ARRAY_STRIDE_;
		this.VERTEX_ATTRIB_ARRAY_TYPE = VERTEX_ATTRIB_ARRAY_TYPE_;
		this.VERTEX_SHADER = VERTEX_SHADER_;
		this.VIEWPORT = VIEWPORT_;
		this.ZERO = ZERO_;
	});
	ptrType = $ptrType(Context);
	ptrType$1 = $ptrType(ContextAttributes);
	mapType = $mapType($String, $Bool);
	ptrType$2 = $ptrType(js.Object);
	sliceType = $sliceType(ptrType$2);
	sliceType$1 = $sliceType($String);
	sliceType$2 = $sliceType($Float32);
	DefaultAttributes = function() {
		var $ptr;
		return new ContextAttributes.ptr(true, true, false, true, true, false);
	};
	$pkg.DefaultAttributes = DefaultAttributes;
	NewContext = function(canvas, ca) {
		var $ptr, attrs, ca, canvas, ctx, gl;
		if ($global.WebGLRenderingContext === undefined) {
			return [ptrType.nil, errors.New("Your browser doesn't appear to support webgl.")];
		}
		if (ca === ptrType$1.nil) {
			ca = DefaultAttributes();
		}
		attrs = $makeMap($String.keyFor, [{ k: "alpha", v: ca.Alpha }, { k: "depth", v: ca.Depth }, { k: "stencil", v: ca.Stencil }, { k: "antialias", v: ca.Antialias }, { k: "premultipliedAlpha", v: ca.PremultipliedAlpha }, { k: "preserveDrawingBuffer", v: ca.PreserveDrawingBuffer }]);
		gl = canvas.getContext($externalize("webgl", $String), $externalize(attrs, mapType));
		if (gl === null) {
			gl = canvas.getContext($externalize("experimental-webgl", $String), $externalize(attrs, mapType));
			if (gl === null) {
				return [ptrType.nil, errors.New("Creating a webgl context has failed.")];
			}
		}
		ctx = new Context.ptr(null, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
		ctx.Object = gl;
		return [ctx, $ifaceNil];
	};
	$pkg.NewContext = NewContext;
	Context.ptr.prototype.GetContextAttributes = function() {
		var $ptr, c, ca;
		c = this;
		ca = c.Object.getContextAttributes();
		return new ContextAttributes.ptr(!!(ca.alpha), !!(ca.depth), !!(ca.stencil), !!(ca.antialias), !!(ca.premultipliedAlpha), !!(ca.preservedDrawingBuffer));
	};
	Context.prototype.GetContextAttributes = function() { return this.$val.GetContextAttributes(); };
	Context.ptr.prototype.ActiveTexture = function(texture) {
		var $ptr, c, texture;
		c = this;
		c.Object.activeTexture(texture);
	};
	Context.prototype.ActiveTexture = function(texture) { return this.$val.ActiveTexture(texture); };
	Context.ptr.prototype.AttachShader = function(program, shader) {
		var $ptr, c, program, shader;
		c = this;
		c.Object.attachShader(program, shader);
	};
	Context.prototype.AttachShader = function(program, shader) { return this.$val.AttachShader(program, shader); };
	Context.ptr.prototype.BindAttribLocation = function(program, index, name) {
		var $ptr, c, index, name, program;
		c = this;
		c.Object.bindAttribLocation(program, index, $externalize(name, $String));
	};
	Context.prototype.BindAttribLocation = function(program, index, name) { return this.$val.BindAttribLocation(program, index, name); };
	Context.ptr.prototype.BindBuffer = function(target, buffer) {
		var $ptr, buffer, c, target;
		c = this;
		c.Object.bindBuffer(target, buffer);
	};
	Context.prototype.BindBuffer = function(target, buffer) { return this.$val.BindBuffer(target, buffer); };
	Context.ptr.prototype.BindFramebuffer = function(target, framebuffer) {
		var $ptr, c, framebuffer, target;
		c = this;
		c.Object.bindFramebuffer(target, framebuffer);
	};
	Context.prototype.BindFramebuffer = function(target, framebuffer) { return this.$val.BindFramebuffer(target, framebuffer); };
	Context.ptr.prototype.BindRenderbuffer = function(target, renderbuffer) {
		var $ptr, c, renderbuffer, target;
		c = this;
		c.Object.bindRenderbuffer(target, renderbuffer);
	};
	Context.prototype.BindRenderbuffer = function(target, renderbuffer) { return this.$val.BindRenderbuffer(target, renderbuffer); };
	Context.ptr.prototype.BindTexture = function(target, texture) {
		var $ptr, c, target, texture;
		c = this;
		c.Object.bindTexture(target, texture);
	};
	Context.prototype.BindTexture = function(target, texture) { return this.$val.BindTexture(target, texture); };
	Context.ptr.prototype.BlendColor = function(r, g, b, a) {
		var $ptr, a, b, c, g, r;
		c = this;
		c.Object.blendColor(r, g, b, a);
	};
	Context.prototype.BlendColor = function(r, g, b, a) { return this.$val.BlendColor(r, g, b, a); };
	Context.ptr.prototype.BlendEquation = function(mode) {
		var $ptr, c, mode;
		c = this;
		c.Object.blendEquation(mode);
	};
	Context.prototype.BlendEquation = function(mode) { return this.$val.BlendEquation(mode); };
	Context.ptr.prototype.BlendEquationSeparate = function(modeRGB, modeAlpha) {
		var $ptr, c, modeAlpha, modeRGB;
		c = this;
		c.Object.blendEquationSeparate(modeRGB, modeAlpha);
	};
	Context.prototype.BlendEquationSeparate = function(modeRGB, modeAlpha) { return this.$val.BlendEquationSeparate(modeRGB, modeAlpha); };
	Context.ptr.prototype.BlendFunc = function(sfactor, dfactor) {
		var $ptr, c, dfactor, sfactor;
		c = this;
		c.Object.blendFunc(sfactor, dfactor);
	};
	Context.prototype.BlendFunc = function(sfactor, dfactor) { return this.$val.BlendFunc(sfactor, dfactor); };
	Context.ptr.prototype.BlendFuncSeparate = function(srcRGB, dstRGB, srcAlpha, dstAlpha) {
		var $ptr, c, dstAlpha, dstRGB, srcAlpha, srcRGB;
		c = this;
		c.Object.blendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha);
	};
	Context.prototype.BlendFuncSeparate = function(srcRGB, dstRGB, srcAlpha, dstAlpha) { return this.$val.BlendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha); };
	Context.ptr.prototype.BufferData = function(target, data, usage) {
		var $ptr, c, data, target, usage;
		c = this;
		c.Object.bufferData(target, $externalize(data, $emptyInterface), usage);
	};
	Context.prototype.BufferData = function(target, data, usage) { return this.$val.BufferData(target, data, usage); };
	Context.ptr.prototype.BufferSubData = function(target, offset, data) {
		var $ptr, c, data, offset, target;
		c = this;
		c.Object.bufferSubData(target, offset, $externalize(data, $emptyInterface));
	};
	Context.prototype.BufferSubData = function(target, offset, data) { return this.$val.BufferSubData(target, offset, data); };
	Context.ptr.prototype.CheckFramebufferStatus = function(target) {
		var $ptr, c, target;
		c = this;
		return $parseInt(c.Object.checkFramebufferStatus(target)) >> 0;
	};
	Context.prototype.CheckFramebufferStatus = function(target) { return this.$val.CheckFramebufferStatus(target); };
	Context.ptr.prototype.Clear = function(flags) {
		var $ptr, c, flags;
		c = this;
		c.Object.clear(flags);
	};
	Context.prototype.Clear = function(flags) { return this.$val.Clear(flags); };
	Context.ptr.prototype.ClearColor = function(r, g, b, a) {
		var $ptr, a, b, c, g, r;
		c = this;
		c.Object.clearColor(r, g, b, a);
	};
	Context.prototype.ClearColor = function(r, g, b, a) { return this.$val.ClearColor(r, g, b, a); };
	Context.ptr.prototype.ClearDepth = function(depth) {
		var $ptr, c, depth;
		c = this;
		c.Object.clearDepth(depth);
	};
	Context.prototype.ClearDepth = function(depth) { return this.$val.ClearDepth(depth); };
	Context.ptr.prototype.ClearStencil = function(s) {
		var $ptr, c, s;
		c = this;
		c.Object.clearStencil(s);
	};
	Context.prototype.ClearStencil = function(s) { return this.$val.ClearStencil(s); };
	Context.ptr.prototype.ColorMask = function(r, g, b, a) {
		var $ptr, a, b, c, g, r;
		c = this;
		c.Object.colorMask($externalize(r, $Bool), $externalize(g, $Bool), $externalize(b, $Bool), $externalize(a, $Bool));
	};
	Context.prototype.ColorMask = function(r, g, b, a) { return this.$val.ColorMask(r, g, b, a); };
	Context.ptr.prototype.CompileShader = function(shader) {
		var $ptr, c, shader;
		c = this;
		c.Object.compileShader(shader);
	};
	Context.prototype.CompileShader = function(shader) { return this.$val.CompileShader(shader); };
	Context.ptr.prototype.CopyTexImage2D = function(target, level, internal, x, y, w, h, border) {
		var $ptr, border, c, h, internal, level, target, w, x, y;
		c = this;
		c.Object.copyTexImage2D(target, level, internal, x, y, w, h, border);
	};
	Context.prototype.CopyTexImage2D = function(target, level, internal, x, y, w, h, border) { return this.$val.CopyTexImage2D(target, level, internal, x, y, w, h, border); };
	Context.ptr.prototype.CopyTexSubImage2D = function(target, level, xoffset, yoffset, x, y, w, h) {
		var $ptr, c, h, level, target, w, x, xoffset, y, yoffset;
		c = this;
		c.Object.copyTexSubImage2D(target, level, xoffset, yoffset, x, y, w, h);
	};
	Context.prototype.CopyTexSubImage2D = function(target, level, xoffset, yoffset, x, y, w, h) { return this.$val.CopyTexSubImage2D(target, level, xoffset, yoffset, x, y, w, h); };
	Context.ptr.prototype.CreateBuffer = function() {
		var $ptr, c;
		c = this;
		return c.Object.createBuffer();
	};
	Context.prototype.CreateBuffer = function() { return this.$val.CreateBuffer(); };
	Context.ptr.prototype.CreateFramebuffer = function() {
		var $ptr, c;
		c = this;
		return c.Object.createFramebuffer();
	};
	Context.prototype.CreateFramebuffer = function() { return this.$val.CreateFramebuffer(); };
	Context.ptr.prototype.CreateProgram = function() {
		var $ptr, c;
		c = this;
		return c.Object.createProgram();
	};
	Context.prototype.CreateProgram = function() { return this.$val.CreateProgram(); };
	Context.ptr.prototype.CreateRenderbuffer = function() {
		var $ptr, c;
		c = this;
		return c.Object.createRenderbuffer();
	};
	Context.prototype.CreateRenderbuffer = function() { return this.$val.CreateRenderbuffer(); };
	Context.ptr.prototype.CreateShader = function(typ) {
		var $ptr, c, typ;
		c = this;
		return c.Object.createShader(typ);
	};
	Context.prototype.CreateShader = function(typ) { return this.$val.CreateShader(typ); };
	Context.ptr.prototype.CreateTexture = function() {
		var $ptr, c;
		c = this;
		return c.Object.createTexture();
	};
	Context.prototype.CreateTexture = function() { return this.$val.CreateTexture(); };
	Context.ptr.prototype.CullFace = function(mode) {
		var $ptr, c, mode;
		c = this;
		c.Object.cullFace(mode);
	};
	Context.prototype.CullFace = function(mode) { return this.$val.CullFace(mode); };
	Context.ptr.prototype.DeleteBuffer = function(buffer) {
		var $ptr, buffer, c;
		c = this;
		c.Object.deleteBuffer(buffer);
	};
	Context.prototype.DeleteBuffer = function(buffer) { return this.$val.DeleteBuffer(buffer); };
	Context.ptr.prototype.DeleteFramebuffer = function(framebuffer) {
		var $ptr, c, framebuffer;
		c = this;
		c.Object.deleteFramebuffer(framebuffer);
	};
	Context.prototype.DeleteFramebuffer = function(framebuffer) { return this.$val.DeleteFramebuffer(framebuffer); };
	Context.ptr.prototype.DeleteProgram = function(program) {
		var $ptr, c, program;
		c = this;
		c.Object.deleteProgram(program);
	};
	Context.prototype.DeleteProgram = function(program) { return this.$val.DeleteProgram(program); };
	Context.ptr.prototype.DeleteRenderbuffer = function(renderbuffer) {
		var $ptr, c, renderbuffer;
		c = this;
		c.Object.deleteRenderbuffer(renderbuffer);
	};
	Context.prototype.DeleteRenderbuffer = function(renderbuffer) { return this.$val.DeleteRenderbuffer(renderbuffer); };
	Context.ptr.prototype.DeleteShader = function(shader) {
		var $ptr, c, shader;
		c = this;
		c.Object.deleteShader(shader);
	};
	Context.prototype.DeleteShader = function(shader) { return this.$val.DeleteShader(shader); };
	Context.ptr.prototype.DeleteTexture = function(texture) {
		var $ptr, c, texture;
		c = this;
		c.Object.deleteTexture(texture);
	};
	Context.prototype.DeleteTexture = function(texture) { return this.$val.DeleteTexture(texture); };
	Context.ptr.prototype.DepthFunc = function(fun) {
		var $ptr, c, fun;
		c = this;
		c.Object.depthFunc(fun);
	};
	Context.prototype.DepthFunc = function(fun) { return this.$val.DepthFunc(fun); };
	Context.ptr.prototype.DepthMask = function(flag) {
		var $ptr, c, flag;
		c = this;
		c.Object.depthMask($externalize(flag, $Bool));
	};
	Context.prototype.DepthMask = function(flag) { return this.$val.DepthMask(flag); };
	Context.ptr.prototype.DepthRange = function(zNear, zFar) {
		var $ptr, c, zFar, zNear;
		c = this;
		c.Object.depthRange(zNear, zFar);
	};
	Context.prototype.DepthRange = function(zNear, zFar) { return this.$val.DepthRange(zNear, zFar); };
	Context.ptr.prototype.DetachShader = function(program, shader) {
		var $ptr, c, program, shader;
		c = this;
		c.Object.detachShader(program, shader);
	};
	Context.prototype.DetachShader = function(program, shader) { return this.$val.DetachShader(program, shader); };
	Context.ptr.prototype.Disable = function(cap) {
		var $ptr, c, cap;
		c = this;
		c.Object.disable(cap);
	};
	Context.prototype.Disable = function(cap) { return this.$val.Disable(cap); };
	Context.ptr.prototype.DisableVertexAttribArray = function(index) {
		var $ptr, c, index;
		c = this;
		c.Object.disableVertexAttribArray(index);
	};
	Context.prototype.DisableVertexAttribArray = function(index) { return this.$val.DisableVertexAttribArray(index); };
	Context.ptr.prototype.DrawArrays = function(mode, first, count) {
		var $ptr, c, count, first, mode;
		c = this;
		c.Object.drawArrays(mode, first, count);
	};
	Context.prototype.DrawArrays = function(mode, first, count) { return this.$val.DrawArrays(mode, first, count); };
	Context.ptr.prototype.DrawElements = function(mode, count, typ, offset) {
		var $ptr, c, count, mode, offset, typ;
		c = this;
		c.Object.drawElements(mode, count, typ, offset);
	};
	Context.prototype.DrawElements = function(mode, count, typ, offset) { return this.$val.DrawElements(mode, count, typ, offset); };
	Context.ptr.prototype.Enable = function(cap) {
		var $ptr, c, cap;
		c = this;
		c.Object.enable(cap);
	};
	Context.prototype.Enable = function(cap) { return this.$val.Enable(cap); };
	Context.ptr.prototype.EnableVertexAttribArray = function(index) {
		var $ptr, c, index;
		c = this;
		c.Object.enableVertexAttribArray(index);
	};
	Context.prototype.EnableVertexAttribArray = function(index) { return this.$val.EnableVertexAttribArray(index); };
	Context.ptr.prototype.Finish = function() {
		var $ptr, c;
		c = this;
		c.Object.finish();
	};
	Context.prototype.Finish = function() { return this.$val.Finish(); };
	Context.ptr.prototype.Flush = function() {
		var $ptr, c;
		c = this;
		c.Object.flush();
	};
	Context.prototype.Flush = function() { return this.$val.Flush(); };
	Context.ptr.prototype.FrameBufferRenderBuffer = function(target, attachment, renderbufferTarget, renderbuffer) {
		var $ptr, attachment, c, renderbuffer, renderbufferTarget, target;
		c = this;
		c.Object.framebufferRenderBuffer(target, attachment, renderbufferTarget, renderbuffer);
	};
	Context.prototype.FrameBufferRenderBuffer = function(target, attachment, renderbufferTarget, renderbuffer) { return this.$val.FrameBufferRenderBuffer(target, attachment, renderbufferTarget, renderbuffer); };
	Context.ptr.prototype.FramebufferTexture2D = function(target, attachment, textarget, texture, level) {
		var $ptr, attachment, c, level, target, textarget, texture;
		c = this;
		c.Object.framebufferTexture2D(target, attachment, textarget, texture, level);
	};
	Context.prototype.FramebufferTexture2D = function(target, attachment, textarget, texture, level) { return this.$val.FramebufferTexture2D(target, attachment, textarget, texture, level); };
	Context.ptr.prototype.FrontFace = function(mode) {
		var $ptr, c, mode;
		c = this;
		c.Object.frontFace(mode);
	};
	Context.prototype.FrontFace = function(mode) { return this.$val.FrontFace(mode); };
	Context.ptr.prototype.GenerateMipmap = function(target) {
		var $ptr, c, target;
		c = this;
		c.Object.generateMipmap(target);
	};
	Context.prototype.GenerateMipmap = function(target) { return this.$val.GenerateMipmap(target); };
	Context.ptr.prototype.GetActiveAttrib = function(program, index) {
		var $ptr, c, index, program;
		c = this;
		return c.Object.getActiveAttrib(program, index);
	};
	Context.prototype.GetActiveAttrib = function(program, index) { return this.$val.GetActiveAttrib(program, index); };
	Context.ptr.prototype.GetActiveUniform = function(program, index) {
		var $ptr, c, index, program;
		c = this;
		return c.Object.getActiveUniform(program, index);
	};
	Context.prototype.GetActiveUniform = function(program, index) { return this.$val.GetActiveUniform(program, index); };
	Context.ptr.prototype.GetAttachedShaders = function(program) {
		var $ptr, c, i, objs, program, shaders;
		c = this;
		objs = c.Object.getAttachedShaders(program);
		shaders = $makeSlice(sliceType, $parseInt(objs.length));
		i = 0;
		while (true) {
			if (!(i < $parseInt(objs.length))) { break; }
			((i < 0 || i >= shaders.$length) ? $throwRuntimeError("index out of range") : shaders.$array[shaders.$offset + i] = objs[i]);
			i = i + (1) >> 0;
		}
		return shaders;
	};
	Context.prototype.GetAttachedShaders = function(program) { return this.$val.GetAttachedShaders(program); };
	Context.ptr.prototype.GetAttribLocation = function(program, name) {
		var $ptr, c, name, program;
		c = this;
		return $parseInt(c.Object.getAttribLocation(program, $externalize(name, $String))) >> 0;
	};
	Context.prototype.GetAttribLocation = function(program, name) { return this.$val.GetAttribLocation(program, name); };
	Context.ptr.prototype.GetBufferParameter = function(target, pname) {
		var $ptr, c, pname, target;
		c = this;
		return c.Object.getBufferParameter(target, pname);
	};
	Context.prototype.GetBufferParameter = function(target, pname) { return this.$val.GetBufferParameter(target, pname); };
	Context.ptr.prototype.GetParameter = function(pname) {
		var $ptr, c, pname;
		c = this;
		return c.Object.getParameter(pname);
	};
	Context.prototype.GetParameter = function(pname) { return this.$val.GetParameter(pname); };
	Context.ptr.prototype.GetError = function() {
		var $ptr, c;
		c = this;
		return $parseInt(c.Object.getError()) >> 0;
	};
	Context.prototype.GetError = function() { return this.$val.GetError(); };
	Context.ptr.prototype.GetExtension = function(name) {
		var $ptr, c, name;
		c = this;
		return c.Object.getExtension($externalize(name, $String));
	};
	Context.prototype.GetExtension = function(name) { return this.$val.GetExtension(name); };
	Context.ptr.prototype.GetFramebufferAttachmentParameter = function(target, attachment, pname) {
		var $ptr, attachment, c, pname, target;
		c = this;
		return c.Object.getFramebufferAttachmentParameter(target, attachment, pname);
	};
	Context.prototype.GetFramebufferAttachmentParameter = function(target, attachment, pname) { return this.$val.GetFramebufferAttachmentParameter(target, attachment, pname); };
	Context.ptr.prototype.GetProgramParameteri = function(program, pname) {
		var $ptr, c, pname, program;
		c = this;
		return $parseInt(c.Object.getProgramParameter(program, pname)) >> 0;
	};
	Context.prototype.GetProgramParameteri = function(program, pname) { return this.$val.GetProgramParameteri(program, pname); };
	Context.ptr.prototype.GetProgramParameterb = function(program, pname) {
		var $ptr, c, pname, program;
		c = this;
		return !!(c.Object.getProgramParameter(program, pname));
	};
	Context.prototype.GetProgramParameterb = function(program, pname) { return this.$val.GetProgramParameterb(program, pname); };
	Context.ptr.prototype.GetProgramInfoLog = function(program) {
		var $ptr, c, program;
		c = this;
		return $internalize(c.Object.getProgramInfoLog(program), $String);
	};
	Context.prototype.GetProgramInfoLog = function(program) { return this.$val.GetProgramInfoLog(program); };
	Context.ptr.prototype.GetRenderbufferParameter = function(target, pname) {
		var $ptr, c, pname, target;
		c = this;
		return c.Object.getRenderbufferParameter(target, pname);
	};
	Context.prototype.GetRenderbufferParameter = function(target, pname) { return this.$val.GetRenderbufferParameter(target, pname); };
	Context.ptr.prototype.GetShaderParameter = function(shader, pname) {
		var $ptr, c, pname, shader;
		c = this;
		return c.Object.getShaderParameter(shader, pname);
	};
	Context.prototype.GetShaderParameter = function(shader, pname) { return this.$val.GetShaderParameter(shader, pname); };
	Context.ptr.prototype.GetShaderParameterb = function(shader, pname) {
		var $ptr, c, pname, shader;
		c = this;
		return !!(c.Object.getShaderParameter(shader, pname));
	};
	Context.prototype.GetShaderParameterb = function(shader, pname) { return this.$val.GetShaderParameterb(shader, pname); };
	Context.ptr.prototype.GetShaderInfoLog = function(shader) {
		var $ptr, c, shader;
		c = this;
		return $internalize(c.Object.getShaderInfoLog(shader), $String);
	};
	Context.prototype.GetShaderInfoLog = function(shader) { return this.$val.GetShaderInfoLog(shader); };
	Context.ptr.prototype.GetShaderSource = function(shader) {
		var $ptr, c, shader;
		c = this;
		return $internalize(c.Object.getShaderSource(shader), $String);
	};
	Context.prototype.GetShaderSource = function(shader) { return this.$val.GetShaderSource(shader); };
	Context.ptr.prototype.GetSupportedExtensions = function() {
		var $ptr, c, ext, extensions, i;
		c = this;
		ext = c.Object.getSupportedExtensions();
		extensions = $makeSlice(sliceType$1, $parseInt(ext.length));
		i = 0;
		while (true) {
			if (!(i < $parseInt(ext.length))) { break; }
			((i < 0 || i >= extensions.$length) ? $throwRuntimeError("index out of range") : extensions.$array[extensions.$offset + i] = $internalize(ext[i], $String));
			i = i + (1) >> 0;
		}
		return extensions;
	};
	Context.prototype.GetSupportedExtensions = function() { return this.$val.GetSupportedExtensions(); };
	Context.ptr.prototype.GetTexParameter = function(target, pname) {
		var $ptr, c, pname, target;
		c = this;
		return c.Object.getTexParameter(target, pname);
	};
	Context.prototype.GetTexParameter = function(target, pname) { return this.$val.GetTexParameter(target, pname); };
	Context.ptr.prototype.GetUniform = function(program, location) {
		var $ptr, c, location, program;
		c = this;
		return c.Object.getUniform(program, location);
	};
	Context.prototype.GetUniform = function(program, location) { return this.$val.GetUniform(program, location); };
	Context.ptr.prototype.GetUniformLocation = function(program, name) {
		var $ptr, c, name, program;
		c = this;
		return c.Object.getUniformLocation(program, $externalize(name, $String));
	};
	Context.prototype.GetUniformLocation = function(program, name) { return this.$val.GetUniformLocation(program, name); };
	Context.ptr.prototype.GetVertexAttrib = function(index, pname) {
		var $ptr, c, index, pname;
		c = this;
		return c.Object.getVertexAttrib(index, pname);
	};
	Context.prototype.GetVertexAttrib = function(index, pname) { return this.$val.GetVertexAttrib(index, pname); };
	Context.ptr.prototype.GetVertexAttribOffset = function(index, pname) {
		var $ptr, c, index, pname;
		c = this;
		return $parseInt(c.Object.getVertexAttribOffset(index, pname)) >> 0;
	};
	Context.prototype.GetVertexAttribOffset = function(index, pname) { return this.$val.GetVertexAttribOffset(index, pname); };
	Context.ptr.prototype.IsBuffer = function(buffer) {
		var $ptr, buffer, c;
		c = this;
		return !!(c.Object.isBuffer(buffer));
	};
	Context.prototype.IsBuffer = function(buffer) { return this.$val.IsBuffer(buffer); };
	Context.ptr.prototype.IsContextLost = function() {
		var $ptr, c;
		c = this;
		return !!(c.Object.isContextLost());
	};
	Context.prototype.IsContextLost = function() { return this.$val.IsContextLost(); };
	Context.ptr.prototype.IsFramebuffer = function(framebuffer) {
		var $ptr, c, framebuffer;
		c = this;
		return !!(c.Object.isFramebuffer(framebuffer));
	};
	Context.prototype.IsFramebuffer = function(framebuffer) { return this.$val.IsFramebuffer(framebuffer); };
	Context.ptr.prototype.IsProgram = function(program) {
		var $ptr, c, program;
		c = this;
		return !!(c.Object.isProgram(program));
	};
	Context.prototype.IsProgram = function(program) { return this.$val.IsProgram(program); };
	Context.ptr.prototype.IsRenderbuffer = function(renderbuffer) {
		var $ptr, c, renderbuffer;
		c = this;
		return !!(c.Object.isRenderbuffer(renderbuffer));
	};
	Context.prototype.IsRenderbuffer = function(renderbuffer) { return this.$val.IsRenderbuffer(renderbuffer); };
	Context.ptr.prototype.IsShader = function(shader) {
		var $ptr, c, shader;
		c = this;
		return !!(c.Object.isShader(shader));
	};
	Context.prototype.IsShader = function(shader) { return this.$val.IsShader(shader); };
	Context.ptr.prototype.IsTexture = function(texture) {
		var $ptr, c, texture;
		c = this;
		return !!(c.Object.isTexture(texture));
	};
	Context.prototype.IsTexture = function(texture) { return this.$val.IsTexture(texture); };
	Context.ptr.prototype.IsEnabled = function(capability) {
		var $ptr, c, capability;
		c = this;
		return !!(c.Object.isEnabled(capability));
	};
	Context.prototype.IsEnabled = function(capability) { return this.$val.IsEnabled(capability); };
	Context.ptr.prototype.LineWidth = function(width) {
		var $ptr, c, width;
		c = this;
		c.Object.lineWidth(width);
	};
	Context.prototype.LineWidth = function(width) { return this.$val.LineWidth(width); };
	Context.ptr.prototype.LinkProgram = function(program) {
		var $ptr, c, program;
		c = this;
		c.Object.linkProgram(program);
	};
	Context.prototype.LinkProgram = function(program) { return this.$val.LinkProgram(program); };
	Context.ptr.prototype.PixelStorei = function(pname, param) {
		var $ptr, c, param, pname;
		c = this;
		c.Object.pixelStorei(pname, param);
	};
	Context.prototype.PixelStorei = function(pname, param) { return this.$val.PixelStorei(pname, param); };
	Context.ptr.prototype.PolygonOffset = function(factor, units) {
		var $ptr, c, factor, units;
		c = this;
		c.Object.polygonOffset(factor, units);
	};
	Context.prototype.PolygonOffset = function(factor, units) { return this.$val.PolygonOffset(factor, units); };
	Context.ptr.prototype.ReadPixels = function(x, y, width, height, format, typ, pixels) {
		var $ptr, c, format, height, pixels, typ, width, x, y;
		c = this;
		c.Object.readPixels(x, y, width, height, format, typ, pixels);
	};
	Context.prototype.ReadPixels = function(x, y, width, height, format, typ, pixels) { return this.$val.ReadPixels(x, y, width, height, format, typ, pixels); };
	Context.ptr.prototype.RenderbufferStorage = function(target, internalFormat, width, height) {
		var $ptr, c, height, internalFormat, target, width;
		c = this;
		c.Object.renderbufferStorage(target, internalFormat, width, height);
	};
	Context.prototype.RenderbufferStorage = function(target, internalFormat, width, height) { return this.$val.RenderbufferStorage(target, internalFormat, width, height); };
	Context.ptr.prototype.Scissor = function(x, y, width, height) {
		var $ptr, c, height, width, x, y;
		c = this;
		c.Object.scissor(x, y, width, height);
	};
	Context.prototype.Scissor = function(x, y, width, height) { return this.$val.Scissor(x, y, width, height); };
	Context.ptr.prototype.ShaderSource = function(shader, source) {
		var $ptr, c, shader, source;
		c = this;
		c.Object.shaderSource(shader, $externalize(source, $String));
	};
	Context.prototype.ShaderSource = function(shader, source) { return this.$val.ShaderSource(shader, source); };
	Context.ptr.prototype.TexImage2D = function(target, level, internalFormat, format, kind, image) {
		var $ptr, c, format, image, internalFormat, kind, level, target;
		c = this;
		c.Object.texImage2D(target, level, internalFormat, format, kind, image);
	};
	Context.prototype.TexImage2D = function(target, level, internalFormat, format, kind, image) { return this.$val.TexImage2D(target, level, internalFormat, format, kind, image); };
	Context.ptr.prototype.TexParameteri = function(target, pname, param) {
		var $ptr, c, param, pname, target;
		c = this;
		c.Object.texParameteri(target, pname, param);
	};
	Context.prototype.TexParameteri = function(target, pname, param) { return this.$val.TexParameteri(target, pname, param); };
	Context.ptr.prototype.TexSubImage2D = function(target, level, xoffset, yoffset, format, typ, image) {
		var $ptr, c, format, image, level, target, typ, xoffset, yoffset;
		c = this;
		c.Object.texSubImage2D(target, level, xoffset, yoffset, format, typ, image);
	};
	Context.prototype.TexSubImage2D = function(target, level, xoffset, yoffset, format, typ, image) { return this.$val.TexSubImage2D(target, level, xoffset, yoffset, format, typ, image); };
	Context.ptr.prototype.Uniform1f = function(location, x) {
		var $ptr, c, location, x;
		c = this;
		c.Object.uniform1f(location, x);
	};
	Context.prototype.Uniform1f = function(location, x) { return this.$val.Uniform1f(location, x); };
	Context.ptr.prototype.Uniform1i = function(location, x) {
		var $ptr, c, location, x;
		c = this;
		c.Object.uniform1i(location, x);
	};
	Context.prototype.Uniform1i = function(location, x) { return this.$val.Uniform1i(location, x); };
	Context.ptr.prototype.Uniform2f = function(location, x, y) {
		var $ptr, c, location, x, y;
		c = this;
		c.Object.uniform2f(location, x, y);
	};
	Context.prototype.Uniform2f = function(location, x, y) { return this.$val.Uniform2f(location, x, y); };
	Context.ptr.prototype.Uniform2i = function(location, x, y) {
		var $ptr, c, location, x, y;
		c = this;
		c.Object.uniform2i(location, x, y);
	};
	Context.prototype.Uniform2i = function(location, x, y) { return this.$val.Uniform2i(location, x, y); };
	Context.ptr.prototype.Uniform3f = function(location, x, y, z) {
		var $ptr, c, location, x, y, z;
		c = this;
		c.Object.uniform3f(location, x, y, z);
	};
	Context.prototype.Uniform3f = function(location, x, y, z) { return this.$val.Uniform3f(location, x, y, z); };
	Context.ptr.prototype.Uniform3i = function(location, x, y, z) {
		var $ptr, c, location, x, y, z;
		c = this;
		c.Object.uniform3i(location, x, y, z);
	};
	Context.prototype.Uniform3i = function(location, x, y, z) { return this.$val.Uniform3i(location, x, y, z); };
	Context.ptr.prototype.Uniform4f = function(location, x, y, z, w) {
		var $ptr, c, location, w, x, y, z;
		c = this;
		c.Object.uniform4f(location, x, y, z, w);
	};
	Context.prototype.Uniform4f = function(location, x, y, z, w) { return this.$val.Uniform4f(location, x, y, z, w); };
	Context.ptr.prototype.Uniform4i = function(location, x, y, z, w) {
		var $ptr, c, location, w, x, y, z;
		c = this;
		c.Object.uniform4i(location, x, y, z, w);
	};
	Context.prototype.Uniform4i = function(location, x, y, z, w) { return this.$val.Uniform4i(location, x, y, z, w); };
	Context.ptr.prototype.UniformMatrix2fv = function(location, transpose, value) {
		var $ptr, c, location, transpose, value;
		c = this;
		c.Object.uniformMatrix2fv(location, $externalize(transpose, $Bool), $externalize(value, sliceType$2));
	};
	Context.prototype.UniformMatrix2fv = function(location, transpose, value) { return this.$val.UniformMatrix2fv(location, transpose, value); };
	Context.ptr.prototype.UniformMatrix3fv = function(location, transpose, value) {
		var $ptr, c, location, transpose, value;
		c = this;
		c.Object.uniformMatrix3fv(location, $externalize(transpose, $Bool), $externalize(value, sliceType$2));
	};
	Context.prototype.UniformMatrix3fv = function(location, transpose, value) { return this.$val.UniformMatrix3fv(location, transpose, value); };
	Context.ptr.prototype.UniformMatrix4fv = function(location, transpose, value) {
		var $ptr, c, location, transpose, value;
		c = this;
		c.Object.uniformMatrix4fv(location, $externalize(transpose, $Bool), $externalize(value, sliceType$2));
	};
	Context.prototype.UniformMatrix4fv = function(location, transpose, value) { return this.$val.UniformMatrix4fv(location, transpose, value); };
	Context.ptr.prototype.UseProgram = function(program) {
		var $ptr, c, program;
		c = this;
		c.Object.useProgram(program);
	};
	Context.prototype.UseProgram = function(program) { return this.$val.UseProgram(program); };
	Context.ptr.prototype.ValidateProgram = function(program) {
		var $ptr, c, program;
		c = this;
		c.Object.validateProgram(program);
	};
	Context.prototype.ValidateProgram = function(program) { return this.$val.ValidateProgram(program); };
	Context.ptr.prototype.VertexAttribPointer = function(index, size, typ, normal, stride, offset) {
		var $ptr, c, index, normal, offset, size, stride, typ;
		c = this;
		c.Object.vertexAttribPointer(index, size, typ, $externalize(normal, $Bool), stride, offset);
	};
	Context.prototype.VertexAttribPointer = function(index, size, typ, normal, stride, offset) { return this.$val.VertexAttribPointer(index, size, typ, normal, stride, offset); };
	Context.ptr.prototype.Viewport = function(x, y, width, height) {
		var $ptr, c, height, width, x, y;
		c = this;
		c.Object.viewport(x, y, width, height);
	};
	Context.prototype.Viewport = function(x, y, width, height) { return this.$val.Viewport(x, y, width, height); };
	ptrType.methods = [{prop: "GetContextAttributes", name: "GetContextAttributes", pkg: "", typ: $funcType([], [ContextAttributes], false)}, {prop: "ActiveTexture", name: "ActiveTexture", pkg: "", typ: $funcType([$Int], [], false)}, {prop: "AttachShader", name: "AttachShader", pkg: "", typ: $funcType([ptrType$2, ptrType$2], [], false)}, {prop: "BindAttribLocation", name: "BindAttribLocation", pkg: "", typ: $funcType([ptrType$2, $Int, $String], [], false)}, {prop: "BindBuffer", name: "BindBuffer", pkg: "", typ: $funcType([$Int, ptrType$2], [], false)}, {prop: "BindFramebuffer", name: "BindFramebuffer", pkg: "", typ: $funcType([$Int, ptrType$2], [], false)}, {prop: "BindRenderbuffer", name: "BindRenderbuffer", pkg: "", typ: $funcType([$Int, ptrType$2], [], false)}, {prop: "BindTexture", name: "BindTexture", pkg: "", typ: $funcType([$Int, ptrType$2], [], false)}, {prop: "BlendColor", name: "BlendColor", pkg: "", typ: $funcType([$Float64, $Float64, $Float64, $Float64], [], false)}, {prop: "BlendEquation", name: "BlendEquation", pkg: "", typ: $funcType([$Int], [], false)}, {prop: "BlendEquationSeparate", name: "BlendEquationSeparate", pkg: "", typ: $funcType([$Int, $Int], [], false)}, {prop: "BlendFunc", name: "BlendFunc", pkg: "", typ: $funcType([$Int, $Int], [], false)}, {prop: "BlendFuncSeparate", name: "BlendFuncSeparate", pkg: "", typ: $funcType([$Int, $Int, $Int, $Int], [], false)}, {prop: "BufferData", name: "BufferData", pkg: "", typ: $funcType([$Int, $emptyInterface, $Int], [], false)}, {prop: "BufferSubData", name: "BufferSubData", pkg: "", typ: $funcType([$Int, $Int, $emptyInterface], [], false)}, {prop: "CheckFramebufferStatus", name: "CheckFramebufferStatus", pkg: "", typ: $funcType([$Int], [$Int], false)}, {prop: "Clear", name: "Clear", pkg: "", typ: $funcType([$Int], [], false)}, {prop: "ClearColor", name: "ClearColor", pkg: "", typ: $funcType([$Float32, $Float32, $Float32, $Float32], [], false)}, {prop: "ClearDepth", name: "ClearDepth", pkg: "", typ: $funcType([$Float64], [], false)}, {prop: "ClearStencil", name: "ClearStencil", pkg: "", typ: $funcType([$Int], [], false)}, {prop: "ColorMask", name: "ColorMask", pkg: "", typ: $funcType([$Bool, $Bool, $Bool, $Bool], [], false)}, {prop: "CompileShader", name: "CompileShader", pkg: "", typ: $funcType([ptrType$2], [], false)}, {prop: "CopyTexImage2D", name: "CopyTexImage2D", pkg: "", typ: $funcType([$Int, $Int, $Int, $Int, $Int, $Int, $Int, $Int], [], false)}, {prop: "CopyTexSubImage2D", name: "CopyTexSubImage2D", pkg: "", typ: $funcType([$Int, $Int, $Int, $Int, $Int, $Int, $Int, $Int], [], false)}, {prop: "CreateBuffer", name: "CreateBuffer", pkg: "", typ: $funcType([], [ptrType$2], false)}, {prop: "CreateFramebuffer", name: "CreateFramebuffer", pkg: "", typ: $funcType([], [ptrType$2], false)}, {prop: "CreateProgram", name: "CreateProgram", pkg: "", typ: $funcType([], [ptrType$2], false)}, {prop: "CreateRenderbuffer", name: "CreateRenderbuffer", pkg: "", typ: $funcType([], [ptrType$2], false)}, {prop: "CreateShader", name: "CreateShader", pkg: "", typ: $funcType([$Int], [ptrType$2], false)}, {prop: "CreateTexture", name: "CreateTexture", pkg: "", typ: $funcType([], [ptrType$2], false)}, {prop: "CullFace", name: "CullFace", pkg: "", typ: $funcType([$Int], [], false)}, {prop: "DeleteBuffer", name: "DeleteBuffer", pkg: "", typ: $funcType([ptrType$2], [], false)}, {prop: "DeleteFramebuffer", name: "DeleteFramebuffer", pkg: "", typ: $funcType([ptrType$2], [], false)}, {prop: "DeleteProgram", name: "DeleteProgram", pkg: "", typ: $funcType([ptrType$2], [], false)}, {prop: "DeleteRenderbuffer", name: "DeleteRenderbuffer", pkg: "", typ: $funcType([ptrType$2], [], false)}, {prop: "DeleteShader", name: "DeleteShader", pkg: "", typ: $funcType([ptrType$2], [], false)}, {prop: "DeleteTexture", name: "DeleteTexture", pkg: "", typ: $funcType([ptrType$2], [], false)}, {prop: "DepthFunc", name: "DepthFunc", pkg: "", typ: $funcType([$Int], [], false)}, {prop: "DepthMask", name: "DepthMask", pkg: "", typ: $funcType([$Bool], [], false)}, {prop: "DepthRange", name: "DepthRange", pkg: "", typ: $funcType([$Float64, $Float64], [], false)}, {prop: "DetachShader", name: "DetachShader", pkg: "", typ: $funcType([ptrType$2, ptrType$2], [], false)}, {prop: "Disable", name: "Disable", pkg: "", typ: $funcType([$Int], [], false)}, {prop: "DisableVertexAttribArray", name: "DisableVertexAttribArray", pkg: "", typ: $funcType([$Int], [], false)}, {prop: "DrawArrays", name: "DrawArrays", pkg: "", typ: $funcType([$Int, $Int, $Int], [], false)}, {prop: "DrawElements", name: "DrawElements", pkg: "", typ: $funcType([$Int, $Int, $Int, $Int], [], false)}, {prop: "Enable", name: "Enable", pkg: "", typ: $funcType([$Int], [], false)}, {prop: "EnableVertexAttribArray", name: "EnableVertexAttribArray", pkg: "", typ: $funcType([$Int], [], false)}, {prop: "Finish", name: "Finish", pkg: "", typ: $funcType([], [], false)}, {prop: "Flush", name: "Flush", pkg: "", typ: $funcType([], [], false)}, {prop: "FrameBufferRenderBuffer", name: "FrameBufferRenderBuffer", pkg: "", typ: $funcType([$Int, $Int, $Int, ptrType$2], [], false)}, {prop: "FramebufferTexture2D", name: "FramebufferTexture2D", pkg: "", typ: $funcType([$Int, $Int, $Int, ptrType$2, $Int], [], false)}, {prop: "FrontFace", name: "FrontFace", pkg: "", typ: $funcType([$Int], [], false)}, {prop: "GenerateMipmap", name: "GenerateMipmap", pkg: "", typ: $funcType([$Int], [], false)}, {prop: "GetActiveAttrib", name: "GetActiveAttrib", pkg: "", typ: $funcType([ptrType$2, $Int], [ptrType$2], false)}, {prop: "GetActiveUniform", name: "GetActiveUniform", pkg: "", typ: $funcType([ptrType$2, $Int], [ptrType$2], false)}, {prop: "GetAttachedShaders", name: "GetAttachedShaders", pkg: "", typ: $funcType([ptrType$2], [sliceType], false)}, {prop: "GetAttribLocation", name: "GetAttribLocation", pkg: "", typ: $funcType([ptrType$2, $String], [$Int], false)}, {prop: "GetBufferParameter", name: "GetBufferParameter", pkg: "", typ: $funcType([$Int, $Int], [ptrType$2], false)}, {prop: "GetParameter", name: "GetParameter", pkg: "", typ: $funcType([$Int], [ptrType$2], false)}, {prop: "GetError", name: "GetError", pkg: "", typ: $funcType([], [$Int], false)}, {prop: "GetExtension", name: "GetExtension", pkg: "", typ: $funcType([$String], [ptrType$2], false)}, {prop: "GetFramebufferAttachmentParameter", name: "GetFramebufferAttachmentParameter", pkg: "", typ: $funcType([$Int, $Int, $Int], [ptrType$2], false)}, {prop: "GetProgramParameteri", name: "GetProgramParameteri", pkg: "", typ: $funcType([ptrType$2, $Int], [$Int], false)}, {prop: "GetProgramParameterb", name: "GetProgramParameterb", pkg: "", typ: $funcType([ptrType$2, $Int], [$Bool], false)}, {prop: "GetProgramInfoLog", name: "GetProgramInfoLog", pkg: "", typ: $funcType([ptrType$2], [$String], false)}, {prop: "GetRenderbufferParameter", name: "GetRenderbufferParameter", pkg: "", typ: $funcType([$Int, $Int], [ptrType$2], false)}, {prop: "GetShaderParameter", name: "GetShaderParameter", pkg: "", typ: $funcType([ptrType$2, $Int], [ptrType$2], false)}, {prop: "GetShaderParameterb", name: "GetShaderParameterb", pkg: "", typ: $funcType([ptrType$2, $Int], [$Bool], false)}, {prop: "GetShaderInfoLog", name: "GetShaderInfoLog", pkg: "", typ: $funcType([ptrType$2], [$String], false)}, {prop: "GetShaderSource", name: "GetShaderSource", pkg: "", typ: $funcType([ptrType$2], [$String], false)}, {prop: "GetSupportedExtensions", name: "GetSupportedExtensions", pkg: "", typ: $funcType([], [sliceType$1], false)}, {prop: "GetTexParameter", name: "GetTexParameter", pkg: "", typ: $funcType([$Int, $Int], [ptrType$2], false)}, {prop: "GetUniform", name: "GetUniform", pkg: "", typ: $funcType([ptrType$2, ptrType$2], [ptrType$2], false)}, {prop: "GetUniformLocation", name: "GetUniformLocation", pkg: "", typ: $funcType([ptrType$2, $String], [ptrType$2], false)}, {prop: "GetVertexAttrib", name: "GetVertexAttrib", pkg: "", typ: $funcType([$Int, $Int], [ptrType$2], false)}, {prop: "GetVertexAttribOffset", name: "GetVertexAttribOffset", pkg: "", typ: $funcType([$Int, $Int], [$Int], false)}, {prop: "IsBuffer", name: "IsBuffer", pkg: "", typ: $funcType([ptrType$2], [$Bool], false)}, {prop: "IsContextLost", name: "IsContextLost", pkg: "", typ: $funcType([], [$Bool], false)}, {prop: "IsFramebuffer", name: "IsFramebuffer", pkg: "", typ: $funcType([ptrType$2], [$Bool], false)}, {prop: "IsProgram", name: "IsProgram", pkg: "", typ: $funcType([ptrType$2], [$Bool], false)}, {prop: "IsRenderbuffer", name: "IsRenderbuffer", pkg: "", typ: $funcType([ptrType$2], [$Bool], false)}, {prop: "IsShader", name: "IsShader", pkg: "", typ: $funcType([ptrType$2], [$Bool], false)}, {prop: "IsTexture", name: "IsTexture", pkg: "", typ: $funcType([ptrType$2], [$Bool], false)}, {prop: "IsEnabled", name: "IsEnabled", pkg: "", typ: $funcType([$Int], [$Bool], false)}, {prop: "LineWidth", name: "LineWidth", pkg: "", typ: $funcType([$Float64], [], false)}, {prop: "LinkProgram", name: "LinkProgram", pkg: "", typ: $funcType([ptrType$2], [], false)}, {prop: "PixelStorei", name: "PixelStorei", pkg: "", typ: $funcType([$Int, $Int], [], false)}, {prop: "PolygonOffset", name: "PolygonOffset", pkg: "", typ: $funcType([$Float64, $Float64], [], false)}, {prop: "ReadPixels", name: "ReadPixels", pkg: "", typ: $funcType([$Int, $Int, $Int, $Int, $Int, $Int, ptrType$2], [], false)}, {prop: "RenderbufferStorage", name: "RenderbufferStorage", pkg: "", typ: $funcType([$Int, $Int, $Int, $Int], [], false)}, {prop: "Scissor", name: "Scissor", pkg: "", typ: $funcType([$Int, $Int, $Int, $Int], [], false)}, {prop: "ShaderSource", name: "ShaderSource", pkg: "", typ: $funcType([ptrType$2, $String], [], false)}, {prop: "TexImage2D", name: "TexImage2D", pkg: "", typ: $funcType([$Int, $Int, $Int, $Int, $Int, ptrType$2], [], false)}, {prop: "TexParameteri", name: "TexParameteri", pkg: "", typ: $funcType([$Int, $Int, $Int], [], false)}, {prop: "TexSubImage2D", name: "TexSubImage2D", pkg: "", typ: $funcType([$Int, $Int, $Int, $Int, $Int, $Int, ptrType$2], [], false)}, {prop: "Uniform1f", name: "Uniform1f", pkg: "", typ: $funcType([ptrType$2, $Float32], [], false)}, {prop: "Uniform1i", name: "Uniform1i", pkg: "", typ: $funcType([ptrType$2, $Int], [], false)}, {prop: "Uniform2f", name: "Uniform2f", pkg: "", typ: $funcType([ptrType$2, $Float32, $Float32], [], false)}, {prop: "Uniform2i", name: "Uniform2i", pkg: "", typ: $funcType([ptrType$2, $Int, $Int], [], false)}, {prop: "Uniform3f", name: "Uniform3f", pkg: "", typ: $funcType([ptrType$2, $Float32, $Float32, $Float32], [], false)}, {prop: "Uniform3i", name: "Uniform3i", pkg: "", typ: $funcType([ptrType$2, $Int, $Int, $Int], [], false)}, {prop: "Uniform4f", name: "Uniform4f", pkg: "", typ: $funcType([ptrType$2, $Float32, $Float32, $Float32, $Float32], [], false)}, {prop: "Uniform4i", name: "Uniform4i", pkg: "", typ: $funcType([ptrType$2, $Int, $Int, $Int, $Int], [], false)}, {prop: "UniformMatrix2fv", name: "UniformMatrix2fv", pkg: "", typ: $funcType([ptrType$2, $Bool, sliceType$2], [], false)}, {prop: "UniformMatrix3fv", name: "UniformMatrix3fv", pkg: "", typ: $funcType([ptrType$2, $Bool, sliceType$2], [], false)}, {prop: "UniformMatrix4fv", name: "UniformMatrix4fv", pkg: "", typ: $funcType([ptrType$2, $Bool, sliceType$2], [], false)}, {prop: "UseProgram", name: "UseProgram", pkg: "", typ: $funcType([ptrType$2], [], false)}, {prop: "ValidateProgram", name: "ValidateProgram", pkg: "", typ: $funcType([ptrType$2], [], false)}, {prop: "VertexAttribPointer", name: "VertexAttribPointer", pkg: "", typ: $funcType([$Int, $Int, $Int, $Bool, $Int, $Int], [], false)}, {prop: "Viewport", name: "Viewport", pkg: "", typ: $funcType([$Int, $Int, $Int, $Int], [], false)}];
	ContextAttributes.init([{prop: "Alpha", name: "Alpha", pkg: "", typ: $Bool, tag: ""}, {prop: "Depth", name: "Depth", pkg: "", typ: $Bool, tag: ""}, {prop: "Stencil", name: "Stencil", pkg: "", typ: $Bool, tag: ""}, {prop: "Antialias", name: "Antialias", pkg: "", typ: $Bool, tag: ""}, {prop: "PremultipliedAlpha", name: "PremultipliedAlpha", pkg: "", typ: $Bool, tag: ""}, {prop: "PreserveDrawingBuffer", name: "PreserveDrawingBuffer", pkg: "", typ: $Bool, tag: ""}]);
	Context.init([{prop: "Object", name: "", pkg: "", typ: ptrType$2, tag: ""}, {prop: "ARRAY_BUFFER", name: "ARRAY_BUFFER", pkg: "", typ: $Int, tag: "js:\"ARRAY_BUFFER\""}, {prop: "ARRAY_BUFFER_BINDING", name: "ARRAY_BUFFER_BINDING", pkg: "", typ: $Int, tag: "js:\"ARRAY_BUFFER_BINDING\""}, {prop: "ATTACHED_SHADERS", name: "ATTACHED_SHADERS", pkg: "", typ: $Int, tag: "js:\"ATTACHED_SHADERS\""}, {prop: "BACK", name: "BACK", pkg: "", typ: $Int, tag: "js:\"BACK\""}, {prop: "BLEND", name: "BLEND", pkg: "", typ: $Int, tag: "js:\"BLEND\""}, {prop: "BLEND_COLOR", name: "BLEND_COLOR", pkg: "", typ: $Int, tag: "js:\"BLEND_COLOR\""}, {prop: "BLEND_DST_ALPHA", name: "BLEND_DST_ALPHA", pkg: "", typ: $Int, tag: "js:\"BLEND_DST_ALPHA\""}, {prop: "BLEND_DST_RGB", name: "BLEND_DST_RGB", pkg: "", typ: $Int, tag: "js:\"BLEND_DST_RGB\""}, {prop: "BLEND_EQUATION", name: "BLEND_EQUATION", pkg: "", typ: $Int, tag: "js:\"BLEND_EQUATION\""}, {prop: "BLEND_EQUATION_ALPHA", name: "BLEND_EQUATION_ALPHA", pkg: "", typ: $Int, tag: "js:\"BLEND_EQUATION_ALPHA\""}, {prop: "BLEND_EQUATION_RGB", name: "BLEND_EQUATION_RGB", pkg: "", typ: $Int, tag: "js:\"BLEND_EQUATION_RGB\""}, {prop: "BLEND_SRC_ALPHA", name: "BLEND_SRC_ALPHA", pkg: "", typ: $Int, tag: "js:\"BLEND_SRC_ALPHA\""}, {prop: "BLEND_SRC_RGB", name: "BLEND_SRC_RGB", pkg: "", typ: $Int, tag: "js:\"BLEND_SRC_RGB\""}, {prop: "BLUE_BITS", name: "BLUE_BITS", pkg: "", typ: $Int, tag: "js:\"BLUE_BITS\""}, {prop: "BOOL", name: "BOOL", pkg: "", typ: $Int, tag: "js:\"BOOL\""}, {prop: "BOOL_VEC2", name: "BOOL_VEC2", pkg: "", typ: $Int, tag: "js:\"BOOL_VEC2\""}, {prop: "BOOL_VEC3", name: "BOOL_VEC3", pkg: "", typ: $Int, tag: "js:\"BOOL_VEC3\""}, {prop: "BOOL_VEC4", name: "BOOL_VEC4", pkg: "", typ: $Int, tag: "js:\"BOOL_VEC4\""}, {prop: "BROWSER_DEFAULT_WEBGL", name: "BROWSER_DEFAULT_WEBGL", pkg: "", typ: $Int, tag: "js:\"BROWSER_DEFAULT_WEBGL\""}, {prop: "BUFFER_SIZE", name: "BUFFER_SIZE", pkg: "", typ: $Int, tag: "js:\"BUFFER_SIZE\""}, {prop: "BUFFER_USAGE", name: "BUFFER_USAGE", pkg: "", typ: $Int, tag: "js:\"BUFFER_USAGE\""}, {prop: "BYTE", name: "BYTE", pkg: "", typ: $Int, tag: "js:\"BYTE\""}, {prop: "CCW", name: "CCW", pkg: "", typ: $Int, tag: "js:\"CCW\""}, {prop: "CLAMP_TO_EDGE", name: "CLAMP_TO_EDGE", pkg: "", typ: $Int, tag: "js:\"CLAMP_TO_EDGE\""}, {prop: "COLOR_ATTACHMENT0", name: "COLOR_ATTACHMENT0", pkg: "", typ: $Int, tag: "js:\"COLOR_ATTACHMENT0\""}, {prop: "COLOR_BUFFER_BIT", name: "COLOR_BUFFER_BIT", pkg: "", typ: $Int, tag: "js:\"COLOR_BUFFER_BIT\""}, {prop: "COLOR_CLEAR_VALUE", name: "COLOR_CLEAR_VALUE", pkg: "", typ: $Int, tag: "js:\"COLOR_CLEAR_VALUE\""}, {prop: "COLOR_WRITEMASK", name: "COLOR_WRITEMASK", pkg: "", typ: $Int, tag: "js:\"COLOR_WRITEMASK\""}, {prop: "COMPILE_STATUS", name: "COMPILE_STATUS", pkg: "", typ: $Int, tag: "js:\"COMPILE_STATUS\""}, {prop: "COMPRESSED_TEXTURE_FORMATS", name: "COMPRESSED_TEXTURE_FORMATS", pkg: "", typ: $Int, tag: "js:\"COMPRESSED_TEXTURE_FORMATS\""}, {prop: "CONSTANT_ALPHA", name: "CONSTANT_ALPHA", pkg: "", typ: $Int, tag: "js:\"CONSTANT_ALPHA\""}, {prop: "CONSTANT_COLOR", name: "CONSTANT_COLOR", pkg: "", typ: $Int, tag: "js:\"CONSTANT_COLOR\""}, {prop: "CONTEXT_LOST_WEBGL", name: "CONTEXT_LOST_WEBGL", pkg: "", typ: $Int, tag: "js:\"CONTEXT_LOST_WEBGL\""}, {prop: "CULL_FACE", name: "CULL_FACE", pkg: "", typ: $Int, tag: "js:\"CULL_FACE\""}, {prop: "CULL_FACE_MODE", name: "CULL_FACE_MODE", pkg: "", typ: $Int, tag: "js:\"CULL_FACE_MODE\""}, {prop: "CURRENT_PROGRAM", name: "CURRENT_PROGRAM", pkg: "", typ: $Int, tag: "js:\"CURRENT_PROGRAM\""}, {prop: "CURRENT_VERTEX_ATTRIB", name: "CURRENT_VERTEX_ATTRIB", pkg: "", typ: $Int, tag: "js:\"CURRENT_VERTEX_ATTRIB\""}, {prop: "CW", name: "CW", pkg: "", typ: $Int, tag: "js:\"CW\""}, {prop: "DECR", name: "DECR", pkg: "", typ: $Int, tag: "js:\"DECR\""}, {prop: "DECR_WRAP", name: "DECR_WRAP", pkg: "", typ: $Int, tag: "js:\"DECR_WRAP\""}, {prop: "DELETE_STATUS", name: "DELETE_STATUS", pkg: "", typ: $Int, tag: "js:\"DELETE_STATUS\""}, {prop: "DEPTH_ATTACHMENT", name: "DEPTH_ATTACHMENT", pkg: "", typ: $Int, tag: "js:\"DEPTH_ATTACHMENT\""}, {prop: "DEPTH_BITS", name: "DEPTH_BITS", pkg: "", typ: $Int, tag: "js:\"DEPTH_BITS\""}, {prop: "DEPTH_BUFFER_BIT", name: "DEPTH_BUFFER_BIT", pkg: "", typ: $Int, tag: "js:\"DEPTH_BUFFER_BIT\""}, {prop: "DEPTH_CLEAR_VALUE", name: "DEPTH_CLEAR_VALUE", pkg: "", typ: $Int, tag: "js:\"DEPTH_CLEAR_VALUE\""}, {prop: "DEPTH_COMPONENT", name: "DEPTH_COMPONENT", pkg: "", typ: $Int, tag: "js:\"DEPTH_COMPONENT\""}, {prop: "DEPTH_COMPONENT16", name: "DEPTH_COMPONENT16", pkg: "", typ: $Int, tag: "js:\"DEPTH_COMPONENT16\""}, {prop: "DEPTH_FUNC", name: "DEPTH_FUNC", pkg: "", typ: $Int, tag: "js:\"DEPTH_FUNC\""}, {prop: "DEPTH_RANGE", name: "DEPTH_RANGE", pkg: "", typ: $Int, tag: "js:\"DEPTH_RANGE\""}, {prop: "DEPTH_STENCIL", name: "DEPTH_STENCIL", pkg: "", typ: $Int, tag: "js:\"DEPTH_STENCIL\""}, {prop: "DEPTH_STENCIL_ATTACHMENT", name: "DEPTH_STENCIL_ATTACHMENT", pkg: "", typ: $Int, tag: "js:\"DEPTH_STENCIL_ATTACHMENT\""}, {prop: "DEPTH_TEST", name: "DEPTH_TEST", pkg: "", typ: $Int, tag: "js:\"DEPTH_TEST\""}, {prop: "DEPTH_WRITEMASK", name: "DEPTH_WRITEMASK", pkg: "", typ: $Int, tag: "js:\"DEPTH_WRITEMASK\""}, {prop: "DITHER", name: "DITHER", pkg: "", typ: $Int, tag: "js:\"DITHER\""}, {prop: "DONT_CARE", name: "DONT_CARE", pkg: "", typ: $Int, tag: "js:\"DONT_CARE\""}, {prop: "DST_ALPHA", name: "DST_ALPHA", pkg: "", typ: $Int, tag: "js:\"DST_ALPHA\""}, {prop: "DST_COLOR", name: "DST_COLOR", pkg: "", typ: $Int, tag: "js:\"DST_COLOR\""}, {prop: "DYNAMIC_DRAW", name: "DYNAMIC_DRAW", pkg: "", typ: $Int, tag: "js:\"DYNAMIC_DRAW\""}, {prop: "ELEMENT_ARRAY_BUFFER", name: "ELEMENT_ARRAY_BUFFER", pkg: "", typ: $Int, tag: "js:\"ELEMENT_ARRAY_BUFFER\""}, {prop: "ELEMENT_ARRAY_BUFFER_BINDING", name: "ELEMENT_ARRAY_BUFFER_BINDING", pkg: "", typ: $Int, tag: "js:\"ELEMENT_ARRAY_BUFFER_BINDING\""}, {prop: "EQUAL", name: "EQUAL", pkg: "", typ: $Int, tag: "js:\"EQUAL\""}, {prop: "FASTEST", name: "FASTEST", pkg: "", typ: $Int, tag: "js:\"FASTEST\""}, {prop: "FLOAT", name: "FLOAT", pkg: "", typ: $Int, tag: "js:\"FLOAT\""}, {prop: "FLOAT_MAT2", name: "FLOAT_MAT2", pkg: "", typ: $Int, tag: "js:\"FLOAT_MAT2\""}, {prop: "FLOAT_MAT3", name: "FLOAT_MAT3", pkg: "", typ: $Int, tag: "js:\"FLOAT_MAT3\""}, {prop: "FLOAT_MAT4", name: "FLOAT_MAT4", pkg: "", typ: $Int, tag: "js:\"FLOAT_MAT4\""}, {prop: "FLOAT_VEC2", name: "FLOAT_VEC2", pkg: "", typ: $Int, tag: "js:\"FLOAT_VEC2\""}, {prop: "FLOAT_VEC3", name: "FLOAT_VEC3", pkg: "", typ: $Int, tag: "js:\"FLOAT_VEC3\""}, {prop: "FLOAT_VEC4", name: "FLOAT_VEC4", pkg: "", typ: $Int, tag: "js:\"FLOAT_VEC4\""}, {prop: "FRAGMENT_SHADER", name: "FRAGMENT_SHADER", pkg: "", typ: $Int, tag: "js:\"FRAGMENT_SHADER\""}, {prop: "FRAMEBUFFER", name: "FRAMEBUFFER", pkg: "", typ: $Int, tag: "js:\"FRAMEBUFFER\""}, {prop: "FRAMEBUFFER_ATTACHMENT_OBJECT_NAME", name: "FRAMEBUFFER_ATTACHMENT_OBJECT_NAME", pkg: "", typ: $Int, tag: "js:\"FRAMEBUFFER_ATTACHMENT_OBJECT_NAME\""}, {prop: "FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE", name: "FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE", pkg: "", typ: $Int, tag: "js:\"FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE\""}, {prop: "FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE", name: "FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE", pkg: "", typ: $Int, tag: "js:\"FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE\""}, {prop: "FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL", name: "FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL", pkg: "", typ: $Int, tag: "js:\"FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL\""}, {prop: "FRAMEBUFFER_BINDING", name: "FRAMEBUFFER_BINDING", pkg: "", typ: $Int, tag: "js:\"FRAMEBUFFER_BINDING\""}, {prop: "FRAMEBUFFER_COMPLETE", name: "FRAMEBUFFER_COMPLETE", pkg: "", typ: $Int, tag: "js:\"FRAMEBUFFER_COMPLETE\""}, {prop: "FRAMEBUFFER_INCOMPLETE_ATTACHMENT", name: "FRAMEBUFFER_INCOMPLETE_ATTACHMENT", pkg: "", typ: $Int, tag: "js:\"FRAMEBUFFER_INCOMPLETE_ATTACHMENT\""}, {prop: "FRAMEBUFFER_INCOMPLETE_DIMENSIONS", name: "FRAMEBUFFER_INCOMPLETE_DIMENSIONS", pkg: "", typ: $Int, tag: "js:\"FRAMEBUFFER_INCOMPLETE_DIMENSIONS\""}, {prop: "FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT", name: "FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT", pkg: "", typ: $Int, tag: "js:\"FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT\""}, {prop: "FRAMEBUFFER_UNSUPPORTED", name: "FRAMEBUFFER_UNSUPPORTED", pkg: "", typ: $Int, tag: "js:\"FRAMEBUFFER_UNSUPPORTED\""}, {prop: "FRONT", name: "FRONT", pkg: "", typ: $Int, tag: "js:\"FRONT\""}, {prop: "FRONT_AND_BACK", name: "FRONT_AND_BACK", pkg: "", typ: $Int, tag: "js:\"FRONT_AND_BACK\""}, {prop: "FRONT_FACE", name: "FRONT_FACE", pkg: "", typ: $Int, tag: "js:\"FRONT_FACE\""}, {prop: "FUNC_ADD", name: "FUNC_ADD", pkg: "", typ: $Int, tag: "js:\"FUNC_ADD\""}, {prop: "FUNC_REVERSE_SUBTRACT", name: "FUNC_REVERSE_SUBTRACT", pkg: "", typ: $Int, tag: "js:\"FUNC_REVERSE_SUBTRACT\""}, {prop: "FUNC_SUBTRACT", name: "FUNC_SUBTRACT", pkg: "", typ: $Int, tag: "js:\"FUNC_SUBTRACT\""}, {prop: "GENERATE_MIPMAP_HINT", name: "GENERATE_MIPMAP_HINT", pkg: "", typ: $Int, tag: "js:\"GENERATE_MIPMAP_HINT\""}, {prop: "GEQUAL", name: "GEQUAL", pkg: "", typ: $Int, tag: "js:\"GEQUAL\""}, {prop: "GREATER", name: "GREATER", pkg: "", typ: $Int, tag: "js:\"GREATER\""}, {prop: "GREEN_BITS", name: "GREEN_BITS", pkg: "", typ: $Int, tag: "js:\"GREEN_BITS\""}, {prop: "HIGH_FLOAT", name: "HIGH_FLOAT", pkg: "", typ: $Int, tag: "js:\"HIGH_FLOAT\""}, {prop: "HIGH_INT", name: "HIGH_INT", pkg: "", typ: $Int, tag: "js:\"HIGH_INT\""}, {prop: "INCR", name: "INCR", pkg: "", typ: $Int, tag: "js:\"INCR\""}, {prop: "INCR_WRAP", name: "INCR_WRAP", pkg: "", typ: $Int, tag: "js:\"INCR_WRAP\""}, {prop: "INFO_LOG_LENGTH", name: "INFO_LOG_LENGTH", pkg: "", typ: $Int, tag: "js:\"INFO_LOG_LENGTH\""}, {prop: "INT", name: "INT", pkg: "", typ: $Int, tag: "js:\"INT\""}, {prop: "INT_VEC2", name: "INT_VEC2", pkg: "", typ: $Int, tag: "js:\"INT_VEC2\""}, {prop: "INT_VEC3", name: "INT_VEC3", pkg: "", typ: $Int, tag: "js:\"INT_VEC3\""}, {prop: "INT_VEC4", name: "INT_VEC4", pkg: "", typ: $Int, tag: "js:\"INT_VEC4\""}, {prop: "INVALID_ENUM", name: "INVALID_ENUM", pkg: "", typ: $Int, tag: "js:\"INVALID_ENUM\""}, {prop: "INVALID_FRAMEBUFFER_OPERATION", name: "INVALID_FRAMEBUFFER_OPERATION", pkg: "", typ: $Int, tag: "js:\"INVALID_FRAMEBUFFER_OPERATION\""}, {prop: "INVALID_OPERATION", name: "INVALID_OPERATION", pkg: "", typ: $Int, tag: "js:\"INVALID_OPERATION\""}, {prop: "INVALID_VALUE", name: "INVALID_VALUE", pkg: "", typ: $Int, tag: "js:\"INVALID_VALUE\""}, {prop: "INVERT", name: "INVERT", pkg: "", typ: $Int, tag: "js:\"INVERT\""}, {prop: "KEEP", name: "KEEP", pkg: "", typ: $Int, tag: "js:\"KEEP\""}, {prop: "LEQUAL", name: "LEQUAL", pkg: "", typ: $Int, tag: "js:\"LEQUAL\""}, {prop: "LESS", name: "LESS", pkg: "", typ: $Int, tag: "js:\"LESS\""}, {prop: "LINEAR", name: "LINEAR", pkg: "", typ: $Int, tag: "js:\"LINEAR\""}, {prop: "LINEAR_MIPMAP_LINEAR", name: "LINEAR_MIPMAP_LINEAR", pkg: "", typ: $Int, tag: "js:\"LINEAR_MIPMAP_LINEAR\""}, {prop: "LINEAR_MIPMAP_NEAREST", name: "LINEAR_MIPMAP_NEAREST", pkg: "", typ: $Int, tag: "js:\"LINEAR_MIPMAP_NEAREST\""}, {prop: "LINES", name: "LINES", pkg: "", typ: $Int, tag: "js:\"LINES\""}, {prop: "LINE_LOOP", name: "LINE_LOOP", pkg: "", typ: $Int, tag: "js:\"LINE_LOOP\""}, {prop: "LINE_STRIP", name: "LINE_STRIP", pkg: "", typ: $Int, tag: "js:\"LINE_STRIP\""}, {prop: "LINE_WIDTH", name: "LINE_WIDTH", pkg: "", typ: $Int, tag: "js:\"LINE_WIDTH\""}, {prop: "LINK_STATUS", name: "LINK_STATUS", pkg: "", typ: $Int, tag: "js:\"LINK_STATUS\""}, {prop: "LOW_FLOAT", name: "LOW_FLOAT", pkg: "", typ: $Int, tag: "js:\"LOW_FLOAT\""}, {prop: "LOW_INT", name: "LOW_INT", pkg: "", typ: $Int, tag: "js:\"LOW_INT\""}, {prop: "LUMINANCE", name: "LUMINANCE", pkg: "", typ: $Int, tag: "js:\"LUMINANCE\""}, {prop: "LUMINANCE_ALPHA", name: "LUMINANCE_ALPHA", pkg: "", typ: $Int, tag: "js:\"LUMINANCE_ALPHA\""}, {prop: "MAX_COMBINED_TEXTURE_IMAGE_UNITS", name: "MAX_COMBINED_TEXTURE_IMAGE_UNITS", pkg: "", typ: $Int, tag: "js:\"MAX_COMBINED_TEXTURE_IMAGE_UNITS\""}, {prop: "MAX_CUBE_MAP_TEXTURE_SIZE", name: "MAX_CUBE_MAP_TEXTURE_SIZE", pkg: "", typ: $Int, tag: "js:\"MAX_CUBE_MAP_TEXTURE_SIZE\""}, {prop: "MAX_FRAGMENT_UNIFORM_VECTORS", name: "MAX_FRAGMENT_UNIFORM_VECTORS", pkg: "", typ: $Int, tag: "js:\"MAX_FRAGMENT_UNIFORM_VECTORS\""}, {prop: "MAX_RENDERBUFFER_SIZE", name: "MAX_RENDERBUFFER_SIZE", pkg: "", typ: $Int, tag: "js:\"MAX_RENDERBUFFER_SIZE\""}, {prop: "MAX_TEXTURE_IMAGE_UNITS", name: "MAX_TEXTURE_IMAGE_UNITS", pkg: "", typ: $Int, tag: "js:\"MAX_TEXTURE_IMAGE_UNITS\""}, {prop: "MAX_TEXTURE_SIZE", name: "MAX_TEXTURE_SIZE", pkg: "", typ: $Int, tag: "js:\"MAX_TEXTURE_SIZE\""}, {prop: "MAX_VARYING_VECTORS", name: "MAX_VARYING_VECTORS", pkg: "", typ: $Int, tag: "js:\"MAX_VARYING_VECTORS\""}, {prop: "MAX_VERTEX_ATTRIBS", name: "MAX_VERTEX_ATTRIBS", pkg: "", typ: $Int, tag: "js:\"MAX_VERTEX_ATTRIBS\""}, {prop: "MAX_VERTEX_TEXTURE_IMAGE_UNITS", name: "MAX_VERTEX_TEXTURE_IMAGE_UNITS", pkg: "", typ: $Int, tag: "js:\"MAX_VERTEX_TEXTURE_IMAGE_UNITS\""}, {prop: "MAX_VERTEX_UNIFORM_VECTORS", name: "MAX_VERTEX_UNIFORM_VECTORS", pkg: "", typ: $Int, tag: "js:\"MAX_VERTEX_UNIFORM_VECTORS\""}, {prop: "MAX_VIEWPORT_DIMS", name: "MAX_VIEWPORT_DIMS", pkg: "", typ: $Int, tag: "js:\"MAX_VIEWPORT_DIMS\""}, {prop: "MEDIUM_FLOAT", name: "MEDIUM_FLOAT", pkg: "", typ: $Int, tag: "js:\"MEDIUM_FLOAT\""}, {prop: "MEDIUM_INT", name: "MEDIUM_INT", pkg: "", typ: $Int, tag: "js:\"MEDIUM_INT\""}, {prop: "MIRRORED_REPEAT", name: "MIRRORED_REPEAT", pkg: "", typ: $Int, tag: "js:\"MIRRORED_REPEAT\""}, {prop: "NEAREST", name: "NEAREST", pkg: "", typ: $Int, tag: "js:\"NEAREST\""}, {prop: "NEAREST_MIPMAP_LINEAR", name: "NEAREST_MIPMAP_LINEAR", pkg: "", typ: $Int, tag: "js:\"NEAREST_MIPMAP_LINEAR\""}, {prop: "NEAREST_MIPMAP_NEAREST", name: "NEAREST_MIPMAP_NEAREST", pkg: "", typ: $Int, tag: "js:\"NEAREST_MIPMAP_NEAREST\""}, {prop: "NEVER", name: "NEVER", pkg: "", typ: $Int, tag: "js:\"NEVER\""}, {prop: "NICEST", name: "NICEST", pkg: "", typ: $Int, tag: "js:\"NICEST\""}, {prop: "NONE", name: "NONE", pkg: "", typ: $Int, tag: "js:\"NONE\""}, {prop: "NOTEQUAL", name: "NOTEQUAL", pkg: "", typ: $Int, tag: "js:\"NOTEQUAL\""}, {prop: "NO_ERROR", name: "NO_ERROR", pkg: "", typ: $Int, tag: "js:\"NO_ERROR\""}, {prop: "NUM_COMPRESSED_TEXTURE_FORMATS", name: "NUM_COMPRESSED_TEXTURE_FORMATS", pkg: "", typ: $Int, tag: "js:\"NUM_COMPRESSED_TEXTURE_FORMATS\""}, {prop: "ONE", name: "ONE", pkg: "", typ: $Int, tag: "js:\"ONE\""}, {prop: "ONE_MINUS_CONSTANT_ALPHA", name: "ONE_MINUS_CONSTANT_ALPHA", pkg: "", typ: $Int, tag: "js:\"ONE_MINUS_CONSTANT_ALPHA\""}, {prop: "ONE_MINUS_CONSTANT_COLOR", name: "ONE_MINUS_CONSTANT_COLOR", pkg: "", typ: $Int, tag: "js:\"ONE_MINUS_CONSTANT_COLOR\""}, {prop: "ONE_MINUS_DST_ALPHA", name: "ONE_MINUS_DST_ALPHA", pkg: "", typ: $Int, tag: "js:\"ONE_MINUS_DST_ALPHA\""}, {prop: "ONE_MINUS_DST_COLOR", name: "ONE_MINUS_DST_COLOR", pkg: "", typ: $Int, tag: "js:\"ONE_MINUS_DST_COLOR\""}, {prop: "ONE_MINUS_SRC_ALPHA", name: "ONE_MINUS_SRC_ALPHA", pkg: "", typ: $Int, tag: "js:\"ONE_MINUS_SRC_ALPHA\""}, {prop: "ONE_MINUS_SRC_COLOR", name: "ONE_MINUS_SRC_COLOR", pkg: "", typ: $Int, tag: "js:\"ONE_MINUS_SRC_COLOR\""}, {prop: "OUT_OF_MEMORY", name: "OUT_OF_MEMORY", pkg: "", typ: $Int, tag: "js:\"OUT_OF_MEMORY\""}, {prop: "PACK_ALIGNMENT", name: "PACK_ALIGNMENT", pkg: "", typ: $Int, tag: "js:\"PACK_ALIGNMENT\""}, {prop: "POINTS", name: "POINTS", pkg: "", typ: $Int, tag: "js:\"POINTS\""}, {prop: "POLYGON_OFFSET_FACTOR", name: "POLYGON_OFFSET_FACTOR", pkg: "", typ: $Int, tag: "js:\"POLYGON_OFFSET_FACTOR\""}, {prop: "POLYGON_OFFSET_FILL", name: "POLYGON_OFFSET_FILL", pkg: "", typ: $Int, tag: "js:\"POLYGON_OFFSET_FILL\""}, {prop: "POLYGON_OFFSET_UNITS", name: "POLYGON_OFFSET_UNITS", pkg: "", typ: $Int, tag: "js:\"POLYGON_OFFSET_UNITS\""}, {prop: "RED_BITS", name: "RED_BITS", pkg: "", typ: $Int, tag: "js:\"RED_BITS\""}, {prop: "RENDERBUFFER", name: "RENDERBUFFER", pkg: "", typ: $Int, tag: "js:\"RENDERBUFFER\""}, {prop: "RENDERBUFFER_ALPHA_SIZE", name: "RENDERBUFFER_ALPHA_SIZE", pkg: "", typ: $Int, tag: "js:\"RENDERBUFFER_ALPHA_SIZE\""}, {prop: "RENDERBUFFER_BINDING", name: "RENDERBUFFER_BINDING", pkg: "", typ: $Int, tag: "js:\"RENDERBUFFER_BINDING\""}, {prop: "RENDERBUFFER_BLUE_SIZE", name: "RENDERBUFFER_BLUE_SIZE", pkg: "", typ: $Int, tag: "js:\"RENDERBUFFER_BLUE_SIZE\""}, {prop: "RENDERBUFFER_DEPTH_SIZE", name: "RENDERBUFFER_DEPTH_SIZE", pkg: "", typ: $Int, tag: "js:\"RENDERBUFFER_DEPTH_SIZE\""}, {prop: "RENDERBUFFER_GREEN_SIZE", name: "RENDERBUFFER_GREEN_SIZE", pkg: "", typ: $Int, tag: "js:\"RENDERBUFFER_GREEN_SIZE\""}, {prop: "RENDERBUFFER_HEIGHT", name: "RENDERBUFFER_HEIGHT", pkg: "", typ: $Int, tag: "js:\"RENDERBUFFER_HEIGHT\""}, {prop: "RENDERBUFFER_INTERNAL_FORMAT", name: "RENDERBUFFER_INTERNAL_FORMAT", pkg: "", typ: $Int, tag: "js:\"RENDERBUFFER_INTERNAL_FORMAT\""}, {prop: "RENDERBUFFER_RED_SIZE", name: "RENDERBUFFER_RED_SIZE", pkg: "", typ: $Int, tag: "js:\"RENDERBUFFER_RED_SIZE\""}, {prop: "RENDERBUFFER_STENCIL_SIZE", name: "RENDERBUFFER_STENCIL_SIZE", pkg: "", typ: $Int, tag: "js:\"RENDERBUFFER_STENCIL_SIZE\""}, {prop: "RENDERBUFFER_WIDTH", name: "RENDERBUFFER_WIDTH", pkg: "", typ: $Int, tag: "js:\"RENDERBUFFER_WIDTH\""}, {prop: "RENDERER", name: "RENDERER", pkg: "", typ: $Int, tag: "js:\"RENDERER\""}, {prop: "REPEAT", name: "REPEAT", pkg: "", typ: $Int, tag: "js:\"REPEAT\""}, {prop: "REPLACE", name: "REPLACE", pkg: "", typ: $Int, tag: "js:\"REPLACE\""}, {prop: "RGB", name: "RGB", pkg: "", typ: $Int, tag: "js:\"RGB\""}, {prop: "RGB5_A1", name: "RGB5_A1", pkg: "", typ: $Int, tag: "js:\"RGB5_A1\""}, {prop: "RGB565", name: "RGB565", pkg: "", typ: $Int, tag: "js:\"RGB565\""}, {prop: "RGBA", name: "RGBA", pkg: "", typ: $Int, tag: "js:\"RGBA\""}, {prop: "RGBA4", name: "RGBA4", pkg: "", typ: $Int, tag: "js:\"RGBA4\""}, {prop: "SAMPLER_2D", name: "SAMPLER_2D", pkg: "", typ: $Int, tag: "js:\"SAMPLER_2D\""}, {prop: "SAMPLER_CUBE", name: "SAMPLER_CUBE", pkg: "", typ: $Int, tag: "js:\"SAMPLER_CUBE\""}, {prop: "SAMPLES", name: "SAMPLES", pkg: "", typ: $Int, tag: "js:\"SAMPLES\""}, {prop: "SAMPLE_ALPHA_TO_COVERAGE", name: "SAMPLE_ALPHA_TO_COVERAGE", pkg: "", typ: $Int, tag: "js:\"SAMPLE_ALPHA_TO_COVERAGE\""}, {prop: "SAMPLE_BUFFERS", name: "SAMPLE_BUFFERS", pkg: "", typ: $Int, tag: "js:\"SAMPLE_BUFFERS\""}, {prop: "SAMPLE_COVERAGE", name: "SAMPLE_COVERAGE", pkg: "", typ: $Int, tag: "js:\"SAMPLE_COVERAGE\""}, {prop: "SAMPLE_COVERAGE_INVERT", name: "SAMPLE_COVERAGE_INVERT", pkg: "", typ: $Int, tag: "js:\"SAMPLE_COVERAGE_INVERT\""}, {prop: "SAMPLE_COVERAGE_VALUE", name: "SAMPLE_COVERAGE_VALUE", pkg: "", typ: $Int, tag: "js:\"SAMPLE_COVERAGE_VALUE\""}, {prop: "SCISSOR_BOX", name: "SCISSOR_BOX", pkg: "", typ: $Int, tag: "js:\"SCISSOR_BOX\""}, {prop: "SCISSOR_TEST", name: "SCISSOR_TEST", pkg: "", typ: $Int, tag: "js:\"SCISSOR_TEST\""}, {prop: "SHADER_COMPILER", name: "SHADER_COMPILER", pkg: "", typ: $Int, tag: "js:\"SHADER_COMPILER\""}, {prop: "SHADER_SOURCE_LENGTH", name: "SHADER_SOURCE_LENGTH", pkg: "", typ: $Int, tag: "js:\"SHADER_SOURCE_LENGTH\""}, {prop: "SHADER_TYPE", name: "SHADER_TYPE", pkg: "", typ: $Int, tag: "js:\"SHADER_TYPE\""}, {prop: "SHADING_LANGUAGE_VERSION", name: "SHADING_LANGUAGE_VERSION", pkg: "", typ: $Int, tag: "js:\"SHADING_LANGUAGE_VERSION\""}, {prop: "SHORT", name: "SHORT", pkg: "", typ: $Int, tag: "js:\"SHORT\""}, {prop: "SRC_ALPHA", name: "SRC_ALPHA", pkg: "", typ: $Int, tag: "js:\"SRC_ALPHA\""}, {prop: "SRC_ALPHA_SATURATE", name: "SRC_ALPHA_SATURATE", pkg: "", typ: $Int, tag: "js:\"SRC_ALPHA_SATURATE\""}, {prop: "SRC_COLOR", name: "SRC_COLOR", pkg: "", typ: $Int, tag: "js:\"SRC_COLOR\""}, {prop: "STATIC_DRAW", name: "STATIC_DRAW", pkg: "", typ: $Int, tag: "js:\"STATIC_DRAW\""}, {prop: "STENCIL_ATTACHMENT", name: "STENCIL_ATTACHMENT", pkg: "", typ: $Int, tag: "js:\"STENCIL_ATTACHMENT\""}, {prop: "STENCIL_BACK_FAIL", name: "STENCIL_BACK_FAIL", pkg: "", typ: $Int, tag: "js:\"STENCIL_BACK_FAIL\""}, {prop: "STENCIL_BACK_FUNC", name: "STENCIL_BACK_FUNC", pkg: "", typ: $Int, tag: "js:\"STENCIL_BACK_FUNC\""}, {prop: "STENCIL_BACK_PASS_DEPTH_FAIL", name: "STENCIL_BACK_PASS_DEPTH_FAIL", pkg: "", typ: $Int, tag: "js:\"STENCIL_BACK_PASS_DEPTH_FAIL\""}, {prop: "STENCIL_BACK_PASS_DEPTH_PASS", name: "STENCIL_BACK_PASS_DEPTH_PASS", pkg: "", typ: $Int, tag: "js:\"STENCIL_BACK_PASS_DEPTH_PASS\""}, {prop: "STENCIL_BACK_REF", name: "STENCIL_BACK_REF", pkg: "", typ: $Int, tag: "js:\"STENCIL_BACK_REF\""}, {prop: "STENCIL_BACK_VALUE_MASK", name: "STENCIL_BACK_VALUE_MASK", pkg: "", typ: $Int, tag: "js:\"STENCIL_BACK_VALUE_MASK\""}, {prop: "STENCIL_BACK_WRITEMASK", name: "STENCIL_BACK_WRITEMASK", pkg: "", typ: $Int, tag: "js:\"STENCIL_BACK_WRITEMASK\""}, {prop: "STENCIL_BITS", name: "STENCIL_BITS", pkg: "", typ: $Int, tag: "js:\"STENCIL_BITS\""}, {prop: "STENCIL_BUFFER_BIT", name: "STENCIL_BUFFER_BIT", pkg: "", typ: $Int, tag: "js:\"STENCIL_BUFFER_BIT\""}, {prop: "STENCIL_CLEAR_VALUE", name: "STENCIL_CLEAR_VALUE", pkg: "", typ: $Int, tag: "js:\"STENCIL_CLEAR_VALUE\""}, {prop: "STENCIL_FAIL", name: "STENCIL_FAIL", pkg: "", typ: $Int, tag: "js:\"STENCIL_FAIL\""}, {prop: "STENCIL_FUNC", name: "STENCIL_FUNC", pkg: "", typ: $Int, tag: "js:\"STENCIL_FUNC\""}, {prop: "STENCIL_INDEX", name: "STENCIL_INDEX", pkg: "", typ: $Int, tag: "js:\"STENCIL_INDEX\""}, {prop: "STENCIL_INDEX8", name: "STENCIL_INDEX8", pkg: "", typ: $Int, tag: "js:\"STENCIL_INDEX8\""}, {prop: "STENCIL_PASS_DEPTH_FAIL", name: "STENCIL_PASS_DEPTH_FAIL", pkg: "", typ: $Int, tag: "js:\"STENCIL_PASS_DEPTH_FAIL\""}, {prop: "STENCIL_PASS_DEPTH_PASS", name: "STENCIL_PASS_DEPTH_PASS", pkg: "", typ: $Int, tag: "js:\"STENCIL_PASS_DEPTH_PASS\""}, {prop: "STENCIL_REF", name: "STENCIL_REF", pkg: "", typ: $Int, tag: "js:\"STENCIL_REF\""}, {prop: "STENCIL_TEST", name: "STENCIL_TEST", pkg: "", typ: $Int, tag: "js:\"STENCIL_TEST\""}, {prop: "STENCIL_VALUE_MASK", name: "STENCIL_VALUE_MASK", pkg: "", typ: $Int, tag: "js:\"STENCIL_VALUE_MASK\""}, {prop: "STENCIL_WRITEMASK", name: "STENCIL_WRITEMASK", pkg: "", typ: $Int, tag: "js:\"STENCIL_WRITEMASK\""}, {prop: "STREAM_DRAW", name: "STREAM_DRAW", pkg: "", typ: $Int, tag: "js:\"STREAM_DRAW\""}, {prop: "SUBPIXEL_BITS", name: "SUBPIXEL_BITS", pkg: "", typ: $Int, tag: "js:\"SUBPIXEL_BITS\""}, {prop: "TEXTURE", name: "TEXTURE", pkg: "", typ: $Int, tag: "js:\"TEXTURE\""}, {prop: "TEXTURE0", name: "TEXTURE0", pkg: "", typ: $Int, tag: "js:\"TEXTURE0\""}, {prop: "TEXTURE1", name: "TEXTURE1", pkg: "", typ: $Int, tag: "js:\"TEXTURE1\""}, {prop: "TEXTURE2", name: "TEXTURE2", pkg: "", typ: $Int, tag: "js:\"TEXTURE2\""}, {prop: "TEXTURE3", name: "TEXTURE3", pkg: "", typ: $Int, tag: "js:\"TEXTURE3\""}, {prop: "TEXTURE4", name: "TEXTURE4", pkg: "", typ: $Int, tag: "js:\"TEXTURE4\""}, {prop: "TEXTURE5", name: "TEXTURE5", pkg: "", typ: $Int, tag: "js:\"TEXTURE5\""}, {prop: "TEXTURE6", name: "TEXTURE6", pkg: "", typ: $Int, tag: "js:\"TEXTURE6\""}, {prop: "TEXTURE7", name: "TEXTURE7", pkg: "", typ: $Int, tag: "js:\"TEXTURE7\""}, {prop: "TEXTURE8", name: "TEXTURE8", pkg: "", typ: $Int, tag: "js:\"TEXTURE8\""}, {prop: "TEXTURE9", name: "TEXTURE9", pkg: "", typ: $Int, tag: "js:\"TEXTURE9\""}, {prop: "TEXTURE10", name: "TEXTURE10", pkg: "", typ: $Int, tag: "js:\"TEXTURE10\""}, {prop: "TEXTURE11", name: "TEXTURE11", pkg: "", typ: $Int, tag: "js:\"TEXTURE11\""}, {prop: "TEXTURE12", name: "TEXTURE12", pkg: "", typ: $Int, tag: "js:\"TEXTURE12\""}, {prop: "TEXTURE13", name: "TEXTURE13", pkg: "", typ: $Int, tag: "js:\"TEXTURE13\""}, {prop: "TEXTURE14", name: "TEXTURE14", pkg: "", typ: $Int, tag: "js:\"TEXTURE14\""}, {prop: "TEXTURE15", name: "TEXTURE15", pkg: "", typ: $Int, tag: "js:\"TEXTURE15\""}, {prop: "TEXTURE16", name: "TEXTURE16", pkg: "", typ: $Int, tag: "js:\"TEXTURE16\""}, {prop: "TEXTURE17", name: "TEXTURE17", pkg: "", typ: $Int, tag: "js:\"TEXTURE17\""}, {prop: "TEXTURE18", name: "TEXTURE18", pkg: "", typ: $Int, tag: "js:\"TEXTURE18\""}, {prop: "TEXTURE19", name: "TEXTURE19", pkg: "", typ: $Int, tag: "js:\"TEXTURE19\""}, {prop: "TEXTURE20", name: "TEXTURE20", pkg: "", typ: $Int, tag: "js:\"TEXTURE20\""}, {prop: "TEXTURE21", name: "TEXTURE21", pkg: "", typ: $Int, tag: "js:\"TEXTURE21\""}, {prop: "TEXTURE22", name: "TEXTURE22", pkg: "", typ: $Int, tag: "js:\"TEXTURE22\""}, {prop: "TEXTURE23", name: "TEXTURE23", pkg: "", typ: $Int, tag: "js:\"TEXTURE23\""}, {prop: "TEXTURE24", name: "TEXTURE24", pkg: "", typ: $Int, tag: "js:\"TEXTURE24\""}, {prop: "TEXTURE25", name: "TEXTURE25", pkg: "", typ: $Int, tag: "js:\"TEXTURE25\""}, {prop: "TEXTURE26", name: "TEXTURE26", pkg: "", typ: $Int, tag: "js:\"TEXTURE26\""}, {prop: "TEXTURE27", name: "TEXTURE27", pkg: "", typ: $Int, tag: "js:\"TEXTURE27\""}, {prop: "TEXTURE28", name: "TEXTURE28", pkg: "", typ: $Int, tag: "js:\"TEXTURE28\""}, {prop: "TEXTURE29", name: "TEXTURE29", pkg: "", typ: $Int, tag: "js:\"TEXTURE29\""}, {prop: "TEXTURE30", name: "TEXTURE30", pkg: "", typ: $Int, tag: "js:\"TEXTURE30\""}, {prop: "TEXTURE31", name: "TEXTURE31", pkg: "", typ: $Int, tag: "js:\"TEXTURE31\""}, {prop: "TEXTURE_2D", name: "TEXTURE_2D", pkg: "", typ: $Int, tag: "js:\"TEXTURE_2D\""}, {prop: "TEXTURE_BINDING_2D", name: "TEXTURE_BINDING_2D", pkg: "", typ: $Int, tag: "js:\"TEXTURE_BINDING_2D\""}, {prop: "TEXTURE_BINDING_CUBE_MAP", name: "TEXTURE_BINDING_CUBE_MAP", pkg: "", typ: $Int, tag: "js:\"TEXTURE_BINDING_CUBE_MAP\""}, {prop: "TEXTURE_CUBE_MAP", name: "TEXTURE_CUBE_MAP", pkg: "", typ: $Int, tag: "js:\"TEXTURE_CUBE_MAP\""}, {prop: "TEXTURE_CUBE_MAP_NEGATIVE_X", name: "TEXTURE_CUBE_MAP_NEGATIVE_X", pkg: "", typ: $Int, tag: "js:\"TEXTURE_CUBE_MAP_NEGATIVE_X\""}, {prop: "TEXTURE_CUBE_MAP_NEGATIVE_Y", name: "TEXTURE_CUBE_MAP_NEGATIVE_Y", pkg: "", typ: $Int, tag: "js:\"TEXTURE_CUBE_MAP_NEGATIVE_Y\""}, {prop: "TEXTURE_CUBE_MAP_NEGATIVE_Z", name: "TEXTURE_CUBE_MAP_NEGATIVE_Z", pkg: "", typ: $Int, tag: "js:\"TEXTURE_CUBE_MAP_NEGATIVE_Z\""}, {prop: "TEXTURE_CUBE_MAP_POSITIVE_X", name: "TEXTURE_CUBE_MAP_POSITIVE_X", pkg: "", typ: $Int, tag: "js:\"TEXTURE_CUBE_MAP_POSITIVE_X\""}, {prop: "TEXTURE_CUBE_MAP_POSITIVE_Y", name: "TEXTURE_CUBE_MAP_POSITIVE_Y", pkg: "", typ: $Int, tag: "js:\"TEXTURE_CUBE_MAP_POSITIVE_Y\""}, {prop: "TEXTURE_CUBE_MAP_POSITIVE_Z", name: "TEXTURE_CUBE_MAP_POSITIVE_Z", pkg: "", typ: $Int, tag: "js:\"TEXTURE_CUBE_MAP_POSITIVE_Z\""}, {prop: "TEXTURE_MAG_FILTER", name: "TEXTURE_MAG_FILTER", pkg: "", typ: $Int, tag: "js:\"TEXTURE_MAG_FILTER\""}, {prop: "TEXTURE_MIN_FILTER", name: "TEXTURE_MIN_FILTER", pkg: "", typ: $Int, tag: "js:\"TEXTURE_MIN_FILTER\""}, {prop: "TEXTURE_WRAP_S", name: "TEXTURE_WRAP_S", pkg: "", typ: $Int, tag: "js:\"TEXTURE_WRAP_S\""}, {prop: "TEXTURE_WRAP_T", name: "TEXTURE_WRAP_T", pkg: "", typ: $Int, tag: "js:\"TEXTURE_WRAP_T\""}, {prop: "TRIANGLES", name: "TRIANGLES", pkg: "", typ: $Int, tag: "js:\"TRIANGLES\""}, {prop: "TRIANGLE_FAN", name: "TRIANGLE_FAN", pkg: "", typ: $Int, tag: "js:\"TRIANGLE_FAN\""}, {prop: "TRIANGLE_STRIP", name: "TRIANGLE_STRIP", pkg: "", typ: $Int, tag: "js:\"TRIANGLE_STRIP\""}, {prop: "UNPACK_ALIGNMENT", name: "UNPACK_ALIGNMENT", pkg: "", typ: $Int, tag: "js:\"UNPACK_ALIGNMENT\""}, {prop: "UNPACK_COLORSPACE_CONVERSION_WEBGL", name: "UNPACK_COLORSPACE_CONVERSION_WEBGL", pkg: "", typ: $Int, tag: "js:\"UNPACK_COLORSPACE_CONVERSION_WEBGL\""}, {prop: "UNPACK_FLIP_Y_WEBGL", name: "UNPACK_FLIP_Y_WEBGL", pkg: "", typ: $Int, tag: "js:\"UNPACK_FLIP_Y_WEBGL\""}, {prop: "UNPACK_PREMULTIPLY_ALPHA_WEBGL", name: "UNPACK_PREMULTIPLY_ALPHA_WEBGL", pkg: "", typ: $Int, tag: "js:\"UNPACK_PREMULTIPLY_ALPHA_WEBGL\""}, {prop: "UNSIGNED_BYTE", name: "UNSIGNED_BYTE", pkg: "", typ: $Int, tag: "js:\"UNSIGNED_BYTE\""}, {prop: "UNSIGNED_INT", name: "UNSIGNED_INT", pkg: "", typ: $Int, tag: "js:\"UNSIGNED_INT\""}, {prop: "UNSIGNED_SHORT", name: "UNSIGNED_SHORT", pkg: "", typ: $Int, tag: "js:\"UNSIGNED_SHORT\""}, {prop: "UNSIGNED_SHORT_4_4_4_4", name: "UNSIGNED_SHORT_4_4_4_4", pkg: "", typ: $Int, tag: "js:\"UNSIGNED_SHORT_4_4_4_4\""}, {prop: "UNSIGNED_SHORT_5_5_5_1", name: "UNSIGNED_SHORT_5_5_5_1", pkg: "", typ: $Int, tag: "js:\"UNSIGNED_SHORT_5_5_5_1\""}, {prop: "UNSIGNED_SHORT_5_6_5", name: "UNSIGNED_SHORT_5_6_5", pkg: "", typ: $Int, tag: "js:\"UNSIGNED_SHORT_5_6_5\""}, {prop: "VALIDATE_STATUS", name: "VALIDATE_STATUS", pkg: "", typ: $Int, tag: "js:\"VALIDATE_STATUS\""}, {prop: "VENDOR", name: "VENDOR", pkg: "", typ: $Int, tag: "js:\"VENDOR\""}, {prop: "VERSION", name: "VERSION", pkg: "", typ: $Int, tag: "js:\"VERSION\""}, {prop: "VERTEX_ATTRIB_ARRAY_BUFFER_BINDING", name: "VERTEX_ATTRIB_ARRAY_BUFFER_BINDING", pkg: "", typ: $Int, tag: "js:\"VERTEX_ATTRIB_ARRAY_BUFFER_BINDING\""}, {prop: "VERTEX_ATTRIB_ARRAY_ENABLED", name: "VERTEX_ATTRIB_ARRAY_ENABLED", pkg: "", typ: $Int, tag: "js:\"VERTEX_ATTRIB_ARRAY_ENABLED\""}, {prop: "VERTEX_ATTRIB_ARRAY_NORMALIZED", name: "VERTEX_ATTRIB_ARRAY_NORMALIZED", pkg: "", typ: $Int, tag: "js:\"VERTEX_ATTRIB_ARRAY_NORMALIZED\""}, {prop: "VERTEX_ATTRIB_ARRAY_POINTER", name: "VERTEX_ATTRIB_ARRAY_POINTER", pkg: "", typ: $Int, tag: "js:\"VERTEX_ATTRIB_ARRAY_POINTER\""}, {prop: "VERTEX_ATTRIB_ARRAY_SIZE", name: "VERTEX_ATTRIB_ARRAY_SIZE", pkg: "", typ: $Int, tag: "js:\"VERTEX_ATTRIB_ARRAY_SIZE\""}, {prop: "VERTEX_ATTRIB_ARRAY_STRIDE", name: "VERTEX_ATTRIB_ARRAY_STRIDE", pkg: "", typ: $Int, tag: "js:\"VERTEX_ATTRIB_ARRAY_STRIDE\""}, {prop: "VERTEX_ATTRIB_ARRAY_TYPE", name: "VERTEX_ATTRIB_ARRAY_TYPE", pkg: "", typ: $Int, tag: "js:\"VERTEX_ATTRIB_ARRAY_TYPE\""}, {prop: "VERTEX_SHADER", name: "VERTEX_SHADER", pkg: "", typ: $Int, tag: "js:\"VERTEX_SHADER\""}, {prop: "VIEWPORT", name: "VIEWPORT", pkg: "", typ: $Int, tag: "js:\"VIEWPORT\""}, {prop: "ZERO", name: "ZERO", pkg: "", typ: $Int, tag: "js:\"ZERO\""}]);
	$init = function() {
		$pkg.$init = function() {};
		/* */ var $f, $c = false, $s = 0, $r; if (this !== undefined && this.$blk !== undefined) { $f = this; $c = true; $s = $f.$s; $r = $f.$r; } s: while (true) { switch ($s) { case 0:
		$r = errors.$init(); /* */ $s = 1; case 1: if($c) { $c = false; $r = $r.$blk(); } if ($r && $r.$blk !== undefined) { break s; }
		$r = js.$init(); /* */ $s = 2; case 2: if($c) { $c = false; $r = $r.$blk(); } if ($r && $r.$blk !== undefined) { break s; }
		/* */ } return; } if ($f === undefined) { $f = { $blk: $init }; } $f.$s = $s; $f.$r = $r; return $f;
	};
	$pkg.$init = $init;
	return $pkg;
})();
$packages["main"] = (function() {
	var $pkg = {}, $init, js, webgl, sliceType, main, initShader, setResolution, getShader;
	js = $packages["github.com/gopherjs/gopherjs/js"];
	webgl = $packages["github.com/gopherjs/webgl"];
	sliceType = $sliceType($Float32);
	main = function() {
		var $ptr, _r, _tuple, _tuple$1, aColor, aPosition, attrs, canvas, document, err, gl, ok, rgba, rgbaBuff, shader, uResolution, vertices, vrtxBuff, $s, $r;
		/* */ $s = 0; var $f, $c = false; if (this !== undefined && this.$blk !== undefined) { $f = this; $c = true; $ptr = $f.$ptr; _r = $f._r; _tuple = $f._tuple; _tuple$1 = $f._tuple$1; aColor = $f.aColor; aPosition = $f.aPosition; attrs = $f.attrs; canvas = $f.canvas; document = $f.document; err = $f.err; gl = $f.gl; ok = $f.ok; rgba = $f.rgba; rgbaBuff = $f.rgbaBuff; shader = $f.shader; uResolution = $f.uResolution; vertices = $f.vertices; vrtxBuff = $f.vrtxBuff; $s = $f.$s; $r = $f.$r; } s: while (true) { switch ($s) { case 0:
		document = $global.document;
		canvas = document.createElement($externalize("canvas", $String));
		document.body.appendChild(canvas);
		$global.console.log($externalize("running webgl_example!", $String));
		attrs = webgl.DefaultAttributes();
		attrs.Alpha = false;
		_tuple = webgl.NewContext(canvas, attrs);
		gl = _tuple[0];
		err = _tuple[1];
		/* */ if (!($interfaceIsEqual(err, $ifaceNil))) { $s = 1; continue; }
		/* */ $s = 2; continue;
		/* if (!($interfaceIsEqual(err, $ifaceNil))) { */ case 1:
			_r = err.Error(); /* */ $s = 3; case 3: if($c) { $c = false; _r = _r.$blk(); } if (_r && _r.$blk !== undefined) { break s; }
			$global.alert($externalize("Error: " + _r, $String));
			return;
		/* } */ case 2:
		_tuple$1 = initShader(gl, canvas);
		shader = _tuple$1[0];
		ok = _tuple$1[1];
		if (!ok) {
			return;
		}
		gl.BlendFuncSeparate($parseInt(gl.Object.SRC_ALPHA) >> 0, $parseInt(gl.Object.ONE_MINUS_SRC_ALPHA) >> 0, $parseInt(gl.Object.ZERO) >> 0, $parseInt(gl.Object.ONE) >> 0);
		gl.Enable($parseInt(gl.Object.BLEND) >> 0);
		uResolution = gl.GetUniformLocation(shader, "u_resolution");
		aPosition = gl.GetAttribLocation(shader, "a_position");
		gl.EnableVertexAttribArray(aPosition);
		aColor = gl.GetAttribLocation(shader, "a_color");
		gl.EnableVertexAttribArray(aColor);
		setResolution(gl, canvas, uResolution);
		gl.ClearColor(0, 1, 1, 1);
		gl.Clear($parseInt(gl.Object.COLOR_BUFFER_BIT) >> 0);
		vertices = new sliceType([16, 16, 128, 16, 128, 128, 128, 128, 16, 128, 16, 16]);
		vrtxBuff = gl.CreateBuffer();
		gl.BindBuffer($parseInt(gl.Object.ARRAY_BUFFER) >> 0, vrtxBuff);
		gl.BufferData($parseInt(gl.Object.ARRAY_BUFFER) >> 0, vertices, $parseInt(gl.Object.STATIC_DRAW) >> 0);
		gl.VertexAttribPointer(aPosition, 2, $parseInt(gl.Object.FLOAT) >> 0, false, 0, 0);
		rgba = new sliceType([1, 0, 0, 0.699999988079071, 1, 0, 0, 0.699999988079071, 1, 0, 0, 0.699999988079071, 1, 0, 0, 0.699999988079071, 1, 0, 0, 0.699999988079071, 1, 0, 0, 0.699999988079071]);
		rgbaBuff = gl.CreateBuffer();
		gl.BindBuffer($parseInt(gl.Object.ARRAY_BUFFER) >> 0, rgbaBuff);
		gl.BufferData($parseInt(gl.Object.ARRAY_BUFFER) >> 0, rgba, $parseInt(gl.Object.STATIC_DRAW) >> 0);
		gl.VertexAttribPointer(aColor, 4, $parseInt(gl.Object.FLOAT) >> 0, false, 0, 0);
		gl.DrawArrays($parseInt(gl.Object.TRIANGLES) >> 0, 0, 6);
		/* */ $s = -1; case -1: } return; } if ($f === undefined) { $f = { $blk: main }; } $f.$ptr = $ptr; $f._r = _r; $f._tuple = _tuple; $f._tuple$1 = _tuple$1; $f.aColor = aColor; $f.aPosition = aPosition; $f.attrs = attrs; $f.canvas = canvas; $f.document = document; $f.err = err; $f.gl = gl; $f.ok = ok; $f.rgba = rgba; $f.rgbaBuff = rgbaBuff; $f.shader = shader; $f.uResolution = uResolution; $f.vertices = vertices; $f.vrtxBuff = vrtxBuff; $f.$s = $s; $f.$r = $r; return $f;
	};
	initShader = function(gl, canvas) {
		var $ptr, _tuple, _tuple$1, canvas, fragShader, gl, ok, shader, vertexShader;
		shader = gl.CreateProgram();
		_tuple = getShader(gl, $parseInt(gl.Object.VERTEX_SHADER) >> 0, "\n    attribute vec2 a_position;\n    attribute vec4 a_color;\n\n    uniform vec2 u_resolution;\n\n    varying vec4 v_color;\n\n    void main() {\n\n        // convert the position from pixels to 0.0 to 1.0\n        vec2 zeroToOne = a_position / u_resolution;\n\n        // convert from 0->1 to 0->2\n        vec2 zeroToTwo = zeroToOne * 2.0;\n\n        // convert from 0->2 to -1->+1 (clipspace)\n        vec2 clipSpace = zeroToTwo - 1.0;\n\n        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);\n        v_color = a_color;\n    }\n");
		vertexShader = _tuple[0];
		ok = _tuple[1];
		if (!ok) {
			$global.alert($externalize("Error getting vertex shader", $String));
			return [null, false];
		}
		_tuple$1 = getShader(gl, $parseInt(gl.Object.FRAGMENT_SHADER) >> 0, "\n    precision mediump float;\n\n    varying vec4 v_color;\n\n    void main() {\n        gl_FragColor = v_color;\n    }\n");
		fragShader = _tuple$1[0];
		ok = _tuple$1[1];
		if (!ok) {
			$global.alert($externalize("Error getting fragment shader", $String));
			return [null, false];
		}
		gl.AttachShader(shader, vertexShader);
		gl.AttachShader(shader, fragShader);
		gl.LinkProgram(shader);
		if (!gl.GetProgramParameterb(shader, $parseInt(gl.Object.LINK_STATUS) >> 0)) {
			$global.alert($externalize("couldnt init shaders :(", $String));
			return [null, false];
		}
		gl.UseProgram(shader);
		return [shader, true];
	};
	setResolution = function(gl, canvas, uResolution) {
		var $ptr, canvas, gl, height, uResolution, width;
		width = $parseInt(canvas.clientWidth) >> 0;
		height = $parseInt(canvas.clientHeight) >> 0;
		if ((!((($parseInt(canvas.width) >> 0) === width))) || (!((($parseInt(canvas.height) >> 0) === height)))) {
			canvas.width = width;
			canvas.height = height;
		}
		gl.Viewport(0, 0, width, height);
		gl.Uniform2f(uResolution, width, height);
	};
	getShader = function(gl, typ, source) {
		var $ptr, gl, shader, source, typ;
		shader = gl.CreateShader(typ);
		gl.ShaderSource(shader, source);
		gl.CompileShader(shader);
		if (!!!(gl.GetShaderParameter(shader, $parseInt(gl.Object.COMPILE_STATUS) >> 0))) {
			$global.alert($externalize(gl.GetShaderInfoLog(shader), $String));
			return [null, false];
		}
		return [shader, true];
	};
	$init = function() {
		$pkg.$init = function() {};
		/* */ var $f, $c = false, $s = 0, $r; if (this !== undefined && this.$blk !== undefined) { $f = this; $c = true; $s = $f.$s; $r = $f.$r; } s: while (true) { switch ($s) { case 0:
		$r = js.$init(); /* */ $s = 1; case 1: if($c) { $c = false; $r = $r.$blk(); } if ($r && $r.$blk !== undefined) { break s; }
		$r = webgl.$init(); /* */ $s = 2; case 2: if($c) { $c = false; $r = $r.$blk(); } if ($r && $r.$blk !== undefined) { break s; }
		/* */ if ($pkg === $mainPkg) { $s = 3; continue; }
		/* */ $s = 4; continue;
		/* if ($pkg === $mainPkg) { */ case 3:
			$r = main(); /* */ $s = 5; case 5: if($c) { $c = false; $r = $r.$blk(); } if ($r && $r.$blk !== undefined) { break s; }
		/* } */ case 4:
		/* */ } return; } if ($f === undefined) { $f = { $blk: $init }; } $f.$s = $s; $f.$r = $r; return $f;
	};
	$pkg.$init = $init;
	return $pkg;
})();
$synthesizeMethods();
var $mainPkg = $packages["main"];
$packages["runtime"].$init();
$go($mainPkg.$init, [], true);
$flushConsole();

}).call(this);
//# sourceMappingURL=webgl_example.js.map
