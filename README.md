# Overview

**pixl-pack** is a module for encoding and decoding JavaScript primitive types to/from a binary blob which can be written to files or sent over a network socket.  This is vaguely similar to using JSON, except that our output is binary, and we support [Buffers](https://nodejs.org/api/buffer.html).  You can pass in many different JavaScript primitives for serialization, including objects and arrays (and buffers inside objects and arrays).

This module uses a proprietary data format.  It is not compatible with [msgpack](http://msgpack.org/).

## Features

- Faster than [msgpack-lite](https://github.com/kawanet/msgpack-lite) (see [Benchmarks](#benchmarks) below).
- Supports [BigInts](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt).
- Low memory overhead (Buffer decoding does not copy memory).
- Stream wrappers included for sending packed objects over streams.

## Supported Types

- Buffer
- Object
- Array
- String
- Number
- BigInt
- Boolean
- Null

# Usage

Use [npm](https://www.npmjs.com/) to install the module:

```sh
npm install pixl-pack
```

Here is a simple usage example:

```js
const Pack = require('pixl-pack');

let buf = Pack.encode({
	"foo": "bar",
	"buf": Buffer.from("Now is the time for all good men to come to the aid of their country."),
	"num": 384738.34341,
	"big": 90000002n,
	"bool": true
});

let data = Pack.decode(buf);
console.log( data );
```

The `encode()` method encodes any supported primitive type to a binary Buffer, and `decode()` does the opposite -- it parses a buffer and returns the original primitive type.  Both methods are synchronous.

Only basic error checking is performed on `decode()`.  If the data is detected as corrupted, it will throw.

## Streams

Stream wrappers are included so you can send pixl-packed objects over IPC, TCP, etc.  The wrappers handle all encoding and decoding at each end of the stream, not to mention chunking and reassembling the bits.  Call `createEncodeStream()` to create an encoding stream wrapper, and `createDecodeStream()` for a decoding stream wrapper.

Here is a streaming example with child processes:

```js
// In the parent process
const Pack = require('pixl-pack');

// spawn worker child
let child = require('child_process').spawn( 
	'node', ['my-worker.js'], 
	{ stdio: ['pipe', 'pipe', 'pipe'] }
);

// connect streams to child's stdio from parent
// (write to child.stdin, read from child.stdout)
let encodeStream = Pack.createEncodeStream();
encodeStream.pipe( child.stdin );

let decodeStream = Pack.createDecodeStream();
child.stdout.pipe( decodeStream );

// send binary object over stream to child's STDIN
encodeStream.write({
	"foo": "bar",
	"buf": Buffer.from("Now is the time for all good men to come to the aid of their country."),
	"num": 384738.34341,
	"big": 90000002n,
	"bool": true
});

// receive response back from child
decodeStream.on('data', function(obj) {
	console.log("Got message from child: ", obj);
	
	// close child's stdin indicating there is no more data to be sent,
	// so child can exit naturally
	child.stdin.end();
});
```

And in the child process we use the same helper functions to setup the other side of the streams:

```js
// In the child process
const Pack = require('pixl-pack');

// connect streams to our stdio in child
let decodeStream = Pack.createDecodeStream();
process.stdin.pipe( decodeStream );

let encodeStream = Pack.createEncodeStream();
encodeStream.pipe( process.stdout );

// wait for object from parent and send it back with changes
decodeStream.on('data', function(obj) {
	obj.num *= 2;
	obj.message = "Return to sender!";
	
	// send it back
	encodeStream.write(obj);
});
```

# Benchmarks

| Test | msgpack-lite | pixl-pack |
|------|--------------|-----------|
| Null | 1,046,159 /sec | 6,518,397 /sec |
| Boolean | 1,016,273 /sec | 5,556,218 /sec |
| String | 784,111 /sec | 1,577,015 /sec |
| Buffer | 859,939 /sec | 3,640,740 /sec |
| Number | 1,181,587 /sec | 5,430,710 /sec |
| Object | 372,714 /sec | 463,397 /sec |
| Array | 856,014 /sec | 968,914 /sec |

Benchmarks were run on a MacBook Pro 2020 with macOS 10.15.5 and Node v12.13.1.

[Benchmark Script](https://gist.github.com/jhuckaby/9e27a039fc8309427a4163e23bfacc85)

# Development

To install pixl-pack for development, run these commands:

```sh
git clone https://github.com/jhuckaby/pixl-pack.git
cd pixl-pack
npm install
```

# License

**The MIT License (MIT)**

*Copyright (c) 2020 Joseph Huckaby.*

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
