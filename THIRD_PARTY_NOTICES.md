# Third-party notices

KodBot itself is licensed under the [MIT License](LICENSE). It builds on,
integrates with, and in places derives from the projects below. Their licenses
apply to their respective material, not to KodBot as a whole.

## OpenCode

KodBot uses the [OpenCode](https://github.com/anomalyco/opencode) CLI as a
separate local agent runtime. OpenCode source code is not vendored in this
repository; the integration code only launches and speaks to that CLI.

OpenCode is distributed under the MIT License:

```text
MIT License

Copyright (c) 2025 opencode

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## OpenMausBot

KodBot began as a fork of
[OpenMausBot](https://github.com/milind-soni/OpenMausBot). Portions of this
repository originate in that project. OpenMausBot is currently distributed
under the Apache License 2.0; a copy is included at
[LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt).

## Other dependencies

JavaScript, Android, Electron, and other dependencies keep their own licenses.
For the source tree, the dependency manifests and lockfile identify those
packages; their license texts are shipped with the packages themselves.
