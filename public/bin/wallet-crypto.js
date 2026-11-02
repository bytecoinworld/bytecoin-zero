(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.BytecoinWalletCrypto = api;
    }
})(typeof self !== 'undefined' ? self : this, function() {
    const MAGIC = new Uint8Array([66, 67, 78, 90, 69, 82, 79, 49]);
    const SALT_SIZE = 16;
    const IV_SIZE = 12;
    const FIXED_HEADER_SIZE = MAGIC.length + SALT_SIZE + IV_SIZE + 2;
    const ITERATIONS = 600000;

    function toBytes(data) {
        if (data instanceof Uint8Array) {
            return data;
        }
        return new Uint8Array(data);
    }

    function isEncrypted(data) {
        const bytes = toBytes(data);
        return bytes.length >= MAGIC.length && MAGIC.every((byte, index) => bytes[index] === byte);
    }

    function parseHeader(data) {
        const bytes = toBytes(data);
        if (!isEncrypted(bytes) || bytes.length < FIXED_HEADER_SIZE) {
            throw new Error('This is not a Bytecoin Zero encrypted wallet backup.');
        }
        if (typeof TextDecoder === 'undefined') {
            throw new Error('Secure wallet backup support is unavailable in this browser.');
        }

        const nameLengthOffset = MAGIC.length + SALT_SIZE + IV_SIZE;
        const nameLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
            .getUint16(nameLengthOffset, false);
        const headerSize = FIXED_HEADER_SIZE + nameLength;
        if (nameLength === 0 || bytes.length < headerSize + 16) {
            throw new Error('The encrypted wallet backup is incomplete or invalid.');
        }

        const filename = new TextDecoder('utf-8', {fatal: true})
            .decode(bytes.subarray(FIXED_HEADER_SIZE, headerSize));
        if (!filename || filename.length > 255) {
            throw new Error('The encrypted wallet backup has an invalid wallet identifier.');
        }

        return {
            bytes,
            filename,
            headerSize,
            header: bytes.subarray(0, headerSize),
            salt: bytes.subarray(MAGIC.length, MAGIC.length + SALT_SIZE),
            iv: bytes.subarray(MAGIC.length + SALT_SIZE, MAGIC.length + SALT_SIZE + IV_SIZE),
        };
    }

    function createContext(cryptoApi, password) {
        let currentPassword = password;
        let currentSalt = null;
        let keyPromise = null;

        function ensureCryptoAvailable() {
            if (!cryptoApi || !cryptoApi.subtle || !cryptoApi.getRandomValues ||
                typeof TextEncoder === 'undefined' || typeof TextDecoder === 'undefined') {
                throw new Error('Secure wallet encryption is unavailable in this browser.');
            }
        }

        function deriveKey(salt) {
            const passwordBytes = new TextEncoder().encode(currentPassword);
            return cryptoApi.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveKey'])
                .then((passwordKey) => cryptoApi.subtle.deriveKey(
                    {name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256'},
                    passwordKey,
                    {name: 'AES-GCM', length: 256},
                    false,
                    ['encrypt', 'decrypt'],
                ));
        }

        function setSalt(salt) {
            const nextSalt = new Uint8Array(salt);
            const sameSalt = currentSalt && currentSalt.length === nextSalt.length &&
                currentSalt.every((byte, index) => byte === nextSalt[index]);
            if (!sameSalt) {
                currentSalt = nextSalt;
                keyPromise = deriveKey(currentSalt);
            }
            return keyPromise;
        }

        async function encrypt(data, filename) {
            ensureCryptoAvailable();
            if (!currentPassword) {
                throw new Error('A non-empty wallet password is required for encryption.');
            }
            if (!filename) {
                throw new Error('The wallet identifier is unavailable.');
            }
            const filenameBytes = new TextEncoder().encode(filename);
            if (filenameBytes.length === 0 || filenameBytes.length > 65535 || filename.length > 255) {
                throw new Error('The wallet identifier is invalid.');
            }

            if (!currentSalt) {
                currentSalt = cryptoApi.getRandomValues(new Uint8Array(SALT_SIZE));
                keyPromise = deriveKey(currentSalt);
            }
            const iv = cryptoApi.getRandomValues(new Uint8Array(IV_SIZE));
            const header = new Uint8Array(FIXED_HEADER_SIZE + filenameBytes.length);
            header.set(MAGIC, 0);
            header.set(currentSalt, MAGIC.length);
            header.set(iv, MAGIC.length + SALT_SIZE);
            new DataView(header.buffer).setUint16(MAGIC.length + SALT_SIZE + IV_SIZE, filenameBytes.length, false);
            header.set(filenameBytes, FIXED_HEADER_SIZE);

            const key = await keyPromise;
            const encrypted = await cryptoApi.subtle.encrypt(
                {name: 'AES-GCM', iv, additionalData: header},
                key,
                toBytes(data),
            );
            const result = new Uint8Array(header.length + encrypted.byteLength);
            result.set(header, 0);
            result.set(new Uint8Array(encrypted), header.length);
            return result;
        }

        async function decrypt(data, expectedFilename) {
            ensureCryptoAvailable();
            const parsed = parseHeader(data);
            if (expectedFilename && parsed.filename !== expectedFilename) {
                throw new Error('The encrypted wallet identifier does not match the stored wallet.');
            }
            if (!currentPassword) {
                throw new Error('Enter the password for this encrypted wallet.');
            }

            try {
                const key = await setSalt(parsed.salt);
                const decrypted = await cryptoApi.subtle.decrypt(
                    {name: 'AES-GCM', iv: parsed.iv, additionalData: parsed.header},
                    key,
                    parsed.bytes.subarray(parsed.headerSize),
                );
                return new Uint8Array(decrypted);
            } catch (error) {
                throw new Error('The password is incorrect or the encrypted wallet file is damaged.');
            }
        }

        return {
            encrypt,
            decrypt,
            clear: function() {
                currentPassword = '';
                currentSalt = null;
                keyPromise = null;
            },
        };
    }

    return {
        createContext,
        isEncrypted,
        getFilename: function(data) {
            return parseHeader(data).filename;
        },
    };
});
