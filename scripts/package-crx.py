#!/usr/bin/env python3
"""Build CRX3 Chrome extension.

Usage: python3 package-crx.py <ext_dir> <key_path> <output_path>
Depends: openssl CLI (pre-installed on Ubuntu/macOS)
"""
import struct
import hashlib
import zipfile
import io
import os
import sys
import subprocess

FILES = [
    'background.js', 'content.js', 'manifest.json',
    'popup.html', 'popup.js', 'rules.js',
]


def _varint(n):
    buf = []
    while n > 0x7f:
        buf.append((n & 0x7f) | 0x80)
        n >>= 7
    buf.append(n & 0x7f)
    return bytes(buf)


def _ld(field, data):
    """Encode length-delimited protobuf field."""
    return _varint((field << 3) | 2) + _varint(len(data)) + data


def main():
    ext_dir = sys.argv[1]
    key_path = sys.argv[2]
    output_path = sys.argv[3]

    with open(key_path, 'rb') as f:
        key_pem = f.read()

    # Public key in DER format
    pub_der = subprocess.check_output(
        ['openssl', 'rsa', '-pubout', '-outform', 'DER'],
        input=key_pem,
    )

    # CRX ID = SHA256(pub_der)[:16]
    crx_id = hashlib.sha256(pub_der).digest()[:16]

    # SignedData { CrxId { id = crx_id } }
    signed_data = _ld(1, _ld(1, crx_id))

    # RSA-PKCS1v15-SHA256 signature over signed_data
    sig = subprocess.check_output(
        ['openssl', 'dgst', '-sha256', '-sign', key_path],
        input=signed_data,
    )

    # AsymmetricKeyProof { public_key, signature }
    proof = _ld(1, pub_der) + _ld(2, sig)

    # CrxFileHeader { sha256_with_rsa[], signed_header_data }
    header = _ld(2, proof) + _ld(10000, signed_data)

    # ZIP payload
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for fn in FILES:
            fp = os.path.join(ext_dir, fn)
            if os.path.exists(fp):
                zf.write(fp, fn)

    zip_data = zbuf.getvalue()

    with open(output_path, 'wb') as f:
        f.write(b'Cr24')
        f.write(struct.pack('<I', 3))
        f.write(struct.pack('<I', len(header)))
        f.write(header)
        f.write(zip_data)

    print(f'CRX3 written to {output_path}  (zip={len(zip_data)}B)')


if __name__ == '__main__':
    main()
