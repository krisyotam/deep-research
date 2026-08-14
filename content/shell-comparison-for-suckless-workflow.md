---
title: "Shell Comparison for Suckless Workflow"
date: 2026-04-26
model: chatgpt-deep-research
slug: shell-comparison-for-suckless-workflow
preview: "Comparing dash, bash, mksh, yash, rc, es, zsh, and fish for a suckless workstation."
---

## The real decision hiding inside the shell decision

The most useful way to frame your problem is not "which shell is best," but "which shell should be interactive, and which shell language should my tools target." That framing is unusually important for your setup because the POSIX shell is a standard interface, `make` uses `/bin/sh` by default, and `npm` runs scripts through `/bin/sh` on POSIX systems unless you override it. In other words, your login shell and your scripting target do **not** have to be the same thing, and in a serious Unix setup they often should not be. That separation is actually very close to the suckless idea of keeping each layer simple and predictable.

That matters directly for the work you named. Suckless software and a lot of low-level Unix development are `make`-driven; your personal `SHELL` is intentionally not supposed to silently change how a Makefile behaves. Your Next.js and Node tooling also already assumes `/bin/sh` for package scripts unless you explicitly reconfigure it. So the shell choice that will actually unblock your reinstall is the choice of an **interactive shell** that gets out of your way, while you keep portable automation in POSIX `sh`.

## The criteria that matter for your workload

For the exact mix you described  --  C, kernel-facing work, suckless tools, some Plan 9 interest, and a simple web stack  --  the relevant criteria are not "most features" or "coolest shell language." They are: closeness to POSIX `sh`, low configuration entropy, solid interactive editing, enough completion to move quickly, documentation that exists when you need it, and a low chance that your shell becomes a second hobby. Those criteria line up with suckless's own emphasis on simplicity, clarity, and frugality for experienced users.

Your Plan 9 interest changes the ranking, but not as much as it first appears. Plan 9 from User Space explicitly warns against putting its `bin` directory ahead of your normal Unix command path because many familiar commands behave differently there. That warning is not anti-Plan 9; it is a reminder that living in Plan 9 semantics on top of Unix is a distinct mode of operation, not a friction-free default for daily Linux work. If you are also maintaining a Node stack and doing general Linux development, that distinction matters.

## The Unix candidates that actually fit

### `dash` and plain `sh`

If what you want is the cleanest possible scripting target, plain POSIX `sh` wins on principle. Debian describes `dash` as a POSIX-compliant shell derived from `ash`, notes that it is used as Debian's default system shell, and explicitly says it executes scripts faster than `bash` and has fewer library dependencies. Debian's `dash` man page also documents history plus built-in `vi` and `emacs` command-line editing for interactive use.

That said, `dash` is best understood as a **script target** and a "nothing fancy, nothing hidden" tool, not as the ideal daily driver for a developer who cares about interactive speed. It can be interactive, but its center of gravity is still `/bin/sh`, not a rich command environment. If you choose `dash` as your main user shell, you are choosing austerity on purpose. That is coherent, but it is more monk-like than productive for most people.

### `bash`

`bash` stays in the Bourne/POSIX family, supports a POSIX mode with `--posix` or `set -o posix`, and enters POSIX mode when invoked as `sh`. It also gives you Readline `vi` mode and programmable completion built directly into the shell. On top of that, the separate `bash-completion` project provides a large on-demand completion library that can stay extremely plain if you keep your config plain.

The trade-off is philosophical more than practical. `bash` is not small in code or surface area, and it is easy to accrete junk into `.bashrc`. But if you keep it lean, it is the least surprising shell in this report for Linux development because it stays close to the shell language your tools already expect while still giving you strong interactive ergonomics. If pure suckless aesthetics were not in the picture, `bash` would be the default practical answer.

### `mksh`

`mksh` is the strongest minimalist Unix candidate in your situation. Its own man page describes it as intended for both interactive and shell-script use, as a superset of `sh` and POSIX shell language, and as largely compatible with the original Korn shell. The same documentation describes interactive mode with job control, startup via `mkshrc`, and both `vi` and `emacs` editing modes. Its project materials also recommend a small sample `~/.mkshrc` to unlock the interactive features cleanly.

What `mksh` buys you is the best balance between ideological restraint and practical compatibility. It stays near `sh` and `ksh`, so the mental model transfers well to portable shell and low-level Unix work, but it is still a real interactive shell. What it does **not** buy you is zsh/fish-class completion magic. The project materials emphasize portability, interactive editing, and shell semantics more than a giant completion ecosystem, and the visible project cadence is slow and stable rather than fast-moving. The canonical site still lists R59c from October 31, 2020. That is not necessarily bad, but it means you should think of `mksh` as a stable tool, not a rapidly evolving shell platform.

### `yash`

The dark horse here is `yash`. Its homepage says it is a POSIX-compliant shell written in C99, intended to be "the most POSIX-compliant shell in the world" while still supporting daily interactive and scripting use. The project also advertises predefined completion scripts for more than 100 commands and command-line prediction based on history, and its current documentation includes interactive mode, history, line editing, command-line completion, command-line prediction, and a POSIXly-correct mode. It also states that it now fully supports POSIX.1-2024 except for listed limitations and describes itself as stable with maintenance releases once or twice a year.

That combination is unusually attractive for someone like you: closer to standards than `fish`, more interactive help than a plain `sh` culture shell, and less config theater than `zsh`. The downside is not that it is bad; it is that it occupies a smaller niche. If you choose `yash`, you are choosing a sharp standards-oriented tool with decent interactivity, but not the cultural center of Linux shell usage. For a self-directed, tool-conscious developer that may be perfectly fine.

## The Plan 9 branch

### `rc`

One reason `rc` feels under-documented on Unix is that "`rc`" is really a **family** of related implementations. Plan 9 from User Space ships its own `rc`; Byron Rakitzis reimplemented `rc` for Unix; and newer standalone ports advertise extra editing, history, and completion support. So when you search for "rc shell," you are not always reading about exactly the same program or the same interactive behavior. That fragmentation is a large part of why the shell feels more mysterious online than `bash`, `zsh`, or `fish`.

The core language is genuinely elegant. The Plan 9 and Rakitzis documentation describe `rc` as a command language built around **lists** rather than Bourne-style stringly word splitting. Rakitzis's manual says the primary data structure is the list, notes that the empty string and the empty list are different, and documents the `^` operator for list concatenation. The Rakitzis README explicitly argues that this cleaner, simpler syntax makes `rc` better than Bourne-compatible shells at handling file names with spaces and makes `rc` scripts less error-prone than `sh` scripts.

That is the real attraction of `rc`: not minimal code size by itself, but a cleaner model of arguments, quoting, and composition. If your Plan 9 curiosity is serious, learning `rc` is worth it because it sharpens your understanding of where Bourne shells are awkward. It is also one of the few shells where "this feels more algebraic and less stringly" is not just romantic talk.

The reason I would **not** make `rc` your primary Linux login shell for this reinstall is that the language win comes with ecosystem and implementation friction. The Plan 9 from User Space man pages describe core shell behavior, prompt handling, and path semantics, but they do not present a modern completion-and-history story the way mainstream shells do. A newer standalone port explicitly markets "edit, history and completion support," which tells you that those conveniences are not a universal `rc` baseline across implementations. Combine that with the path-behavior warning in Plan 9 from User Space, and `rc` reads much better as a second shell for Plan 9-shaped work than as the daily shell for all Linux tasks.

### `es`

`es` is even more intellectually interesting and even less likely to solve your reinstall bottleneck. Its own site says it is derived from `rc` and influenced by Scheme and Tcl. It explicitly advertises first-class functions, lexical scope, exceptions, rich return values, and deep extensibility, and its paper frames the project as an experiment in building a simple but highly programmable shell using ideas from functional languages. The current site also says the shell's heyday was roughly 1993 to 1996 and that the present effort is an unofficial attempt to keep it working on modern Unix systems.

That makes `es` a fascinating research shell and a bad answer to "I need to stop wasting time on shell choice so I can reinstall and work." If you want a shell as a language-design rabbit hole, `es` is absolutely worth reading. If you want one shell that helps you write C, build Linux software, maintain websites, and mostly disappear, `es` is overcorrecting in the opposite direction.

## Why `zsh` and `fish` are probably not your landing zone

`zsh` is excellent, but it is excellent in exactly the direction you are trying to leave. Its manual describes a shell with command-line editing, spelling correction, programmable completion, autoloaded functions, and history; its user guide describes it as a particularly powerful interactive shell with a highly configurable completion system and the ability to emulate `sh` or `ksh` if you deliberately configure it to do so. The problem is that its default mode is not POSIX-compatible, and its strengths invite further customization rather than restraint. If you loved shell mechanics for their own sake, that would be a feature. In a suckless rebuild, it is likely to keep the shell as a project.

`fish` is the mirror image. Its current docs emphasize syntax highlighting, autosuggestions, tab completions that "just work," and a ready-to-use interactive experience with very little configuration. But the project is explicit that `fish` is intentionally **not** POSIX-compatible, and its "Fish for bash users" docs call out major language differences, including command substitution splitting on newlines rather than `$IFS`. That language split is manageable if `fish` is only a pleasant interactive frontend. It becomes costly if you are constantly moving between `/bin/sh`, Makefiles, package scripts, and shell snippets in low-level tooling. In your case, you have already found a terminal/multiplexer-related compatibility issue; that is exactly the kind of friction that turns an otherwise lovely shell into the wrong default.

## What I would use in your position

If I were optimizing for **your** mix of goals rather than for generic popularity, I would use **`mksh` as the interactive login shell**, keep the distro's `/bin/sh` as the portable script target, and install **`rc` as a secondary shell** for Plan 9 work and for learning its model. That gives you one daily shell that stays close to POSIX and `ksh`, one script target that aligns with `make` and `npm`, and one Plan 9-shaped shell that you can enter on purpose instead of living in by accident.

The reason I land on `mksh` instead of `bash` is that it is the cleanest compromise between your values and your workload. It is smaller in spirit, close to the shell family your tools expect, interactive enough to daily-drive, and far less conceptually sideways than `rc` or `fish`. The reason I do **not** land on `rc` is that its elegance is real but its Unix reality is fragmented. The reason I do **not** land on `fish` is that the language break is permanent, not incidental. And the reason I do **not** land on `zsh` is that it solves the wrong problem by offering more shell than you need.

There are two important caveats. First, if after a short real-world trial you find that `mksh`'s completion ceiling slows you down too much, the correct fallback is **`bash`**, not `zsh` and not `fish`. `bash` gives you `vi` mode, programmable completion, and a huge completion ecosystem without forcing a second shell language into your day. Second, if you want a standards-heavy alternative with more interactive help than `mksh`, `yash` is the most credible dark horse here and is much more serious than its lack of hype suggests.

If you force me to give you one single shell name for the reinstall, my answer is **`mksh`**. Not because it is perfect, and not because it is the absolute fastest shell to configure for every possible workflow, but because it gives you the best ratio of simplicity, compatibility, and conceptual cleanliness for Linux C work while leaving room for Plan 9 exploration without turning your whole workstation into an experiment.
