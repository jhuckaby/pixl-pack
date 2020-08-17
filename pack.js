// pixl-pack: Binary Object Serialization System
// Simple but fast binary object encoder / decoder
// Copyright (c) 2020 Joseph Huckaby and PixlCore.com.
// Released under the MIT License.

// Buffers are sliced on decode (they share the original memory).
// Arrays must NOT be sparse and MUST be 0-based.
// Beats msgpack-lite on speed (but not size).
// Key max length: 64 K, Value max length: 4 GB

const TYPE_BUFFER = 0;
const TYPE_STRING = 1;
const TYPE_NUMBER = 2;
const TYPE_BOOLEAN = 3;
const TYPE_OBJECT = 4;
const TYPE_ARRAY = 5;
const TYPE_BIGINT = 6;
const TYPE_NULL = 7;

module.exports = {
	
	encode: function(value) {
		// encode any value to binary buffer
		// recurse for objects and arrays
		var buf = value;
		
		if (!Buffer.isBuffer(value)) {
			if (value === null) {
				// null (0 bytes)
				buf = Buffer.allocUnsafe( 1 ); // reserve 1
				buf.writeUInt8( TYPE_NULL, 0 );
			}
			else if (Array.isArray(value)) {
				// array (complex)
				var chunks = [];
				
				// array length
				chunk = Buffer.allocUnsafe( 1 + 4 ); // reserve 1
				chunk.writeUInt8( TYPE_ARRAY, 0 );
				chunk.writeUInt32BE( value.length, 1 );
				chunks.push( chunk );
				
				// array contents
				for (var idx = 0, len = value.length; idx < len; idx++) {
					chunks.push( this.encode(value[idx]) );
				}
				
				buf = Buffer.concat( chunks );
			}
			else if (typeof(value) == 'object') {
				// hash object (complex)
				var chunks = [];
				var chunk = null;
				var keyBuf = null;
				var keys = Object.keys(value);
				var key = null;
				
				// hash length
				chunk = Buffer.allocUnsafe( 1 + 4 ); // reserve 1
				chunk.writeUInt8( TYPE_OBJECT, 0 );
				chunk.writeUInt32BE( keys.length, 1 );
				chunks.push( chunk );
				
				// hash contents
				for (var idx = 0, len = keys.length; idx < len; idx++) {
					key = keys[idx];
					keyBuf = Buffer.from( ''+key, 'utf8' );
					chunk = Buffer.allocUnsafe( 2 + keyBuf.length );
					chunk.writeUInt16BE( keyBuf.length, 0 );
					keyBuf.copy( chunk, 2 );
					chunks.push( chunk, this.encode(value[key]) );
				}
				
				buf = Buffer.concat( chunks );
			}
			else if (typeof(value) == 'number') {
				// Number (8 bytes)
				buf = Buffer.allocUnsafe( 1 + 8 ); // reserve 1
				buf.writeUInt8( TYPE_NUMBER, 0 );
				buf.writeDoubleBE( value, 1 );
			}
			else if (typeof(value) == 'bigint') {
				// BigInt (8 bytes)
				buf = Buffer.allocUnsafe( 1 + 8 ); // reserve 1
				buf.writeUInt8( TYPE_BIGINT, 0 );
				buf.writeBigInt64BE( value, 1 );
			}
			else if (typeof(value) == 'boolean') {
				// boolean (1 byte)
				buf = Buffer.allocUnsafe( 1 + 1 ); // reserve 1
				buf.writeUInt8( TYPE_BOOLEAN, 0 );
				buf.writeUInt8( value ? 1 : 0, 1 );
			}
			else {
				// assume string if not known
				if (typeof(value) != 'string') value = '' + value;
				var strBuf = Buffer.from( value, 'utf8' );
				
				buf = Buffer.allocUnsafe( 1 + 4 + strBuf.length ); // reserve 1
				buf.writeUInt8( TYPE_STRING, 0 );
				buf.writeUInt32BE( strBuf.length, 1 );
				strBuf.copy( buf, 5 );
			}
		}
		else {
			// buffer (variable length)
			buf = Buffer.allocUnsafe( 1 + 4 + value.length );
			buf.writeUInt8( TYPE_BUFFER, 0 );
			buf.writeUInt32BE( value.length, 1 );
			value.copy( buf, 5 );
		}
		
		return buf;
	},
	
	decode: function(buf) {
		// decode binary buffer back into native type
		var value = null;
		var cleanup = false;
		
		if (!("_offset" in buf)) {
			// add custom cursor to buffer so we can keep track
			buf._offset = 0;
			cleanup = true;
		}
		
		flags = buf.readUInt8( buf._offset );
		if (flags > 7) throw new Error("Invalid data: Unknown flag: " + flags + " at offset " + buf._offset + ".");
		buf._offset++;
		
		switch (flags) {
			case TYPE_NULL:
				value = null;
			break;
			
			case TYPE_ARRAY:
				var arrLen = buf.readUInt32BE(buf._offset); buf._offset += 4;
				value = [];
				
				for (var idx = 0; idx < arrLen; idx++) {
					value.push( this.decode(buf) );
				}
			break;
			
			case TYPE_OBJECT: 
				var numKeys = buf.readUInt32BE(buf._offset); buf._offset += 4;
				var keyLen = 0;
				var key = '';
				value = {};
				
				for (var idx = 0; idx < numKeys; idx++) {
					keyLen = buf.readUInt16BE(buf._offset); buf._offset += 2;
					key = buf.slice( buf._offset, buf._offset + keyLen ).toString(); buf._offset += keyLen;
					value[key] = this.decode(buf);
				}
			break;
			
			case TYPE_NUMBER:
				value = buf.readDoubleBE(buf._offset); buf._offset += 8;
			break;
			
			case TYPE_BIGINT:
				value = buf.readBigInt64BE(buf._offset); buf._offset += 8;
			break;
			
			case TYPE_BOOLEAN:
				value = (buf.readUInt8(buf._offset++) == 1) ? true : false;
			break;
			
			case TYPE_STRING:
				var strLen = buf.readUInt32BE(buf._offset); buf._offset += 4;
				value = buf.slice( buf._offset, buf._offset + strLen ).toString(); buf._offset += strLen;
			break;
			
			case TYPE_BUFFER:
				var bufLen = buf.readUInt32BE(buf._offset); buf._offset += 4;
				value = buf.slice( buf._offset, buf._offset + bufLen ); buf._offset += bufLen;
			break;
		} // switch
		
		if (cleanup) {
			if (buf._offset > buf.length) throw new Error("Invalid data: Offset is beyond buffer length.");
			delete buf._offset;
		}
		
		return value;
	}
	
};
