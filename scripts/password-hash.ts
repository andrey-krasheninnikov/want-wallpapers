const password = (await Bun.stdin.text()).replace(/\r?\n$/, '');
if (password.length < 16) throw new Error('Password must contain at least 16 characters.');
console.log(await Bun.password.hash(password, { algorithm: 'argon2id', memoryCost: 65536, timeCost: 3 }));
