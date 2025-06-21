{ lib
, stdenvNoCC
, python3
, python3Packages
, installShellFiles
}:

let
  manifest = builtins.fromJSON (builtins.readFile ../package.json);
  
  pythonEnv = python3.withPackages (ps: with ps; [
    pathspec
    pyyaml
    toml
  ]);
in
stdenvNoCC.mkDerivation {
  pname = manifest.name;
  version = manifest.version;
  
  src = ../.;
  
  nativeBuildInputs = [ installShellFiles ];
  buildInputs = [ pythonEnv ];
  
  dontBuild = true;
  
  installPhase = ''
    # Create output directory
    mkdir -p $out/bin
    
    # Install main scripts
    cp git-format-staged $out/bin/git-format-staged
    cp git-format-all $out/bin/git-format-all
    
    # Make scripts executable
    chmod +x $out/bin/*
    
    # Patch shebang to use our Python environment
    patchShebangs $out/bin/git-format-staged
    
    # Install shell completions
    installShellCompletion \
      --bash completions/bash/git-format-staged-completion.bash \
      --zsh completions/zsh/_git-format-staged \
      --fish completions/fish/git-format-staged.fish
    
    # Also install completions for git-format-all (reuse same completion files)
    installShellCompletion --name git-format-all \
      --bash completions/bash/git-format-staged-completion.bash \
      --zsh completions/zsh/_git-format-staged \
      --fish completions/fish/git-format-staged.fish
    
    # Install example configs
    mkdir -p $out/share/doc/git-format-staged
    cp *.example $out/share/doc/git-format-staged/
    cp README.md $out/share/doc/git-format-staged/
    cp BREAKING_CHANGES.md $out/share/doc/git-format-staged/
  '';
  
  meta = {
    description = manifest.description;
    longDescription = ''
      git-format-staged formats staged git files via stdin/stdout formatters.
      
      Version 4 includes:
      - Fixed pattern matching using pathspec library (gitignore-style)
      - Configuration file support (YAML/TOML)
      - Multiple formatter pipelines
      - Working tree formatting modes (--unstaged, --also-unstaged)
      - Comprehensive debug output
      - Shell completion support
      - git-format-all helper command
    '';
    homepage = manifest.homepage;
    license = lib.licenses.mit;
    maintainers = [];
    platforms = lib.platforms.all;
    mainProgram = "git-format-staged";
  };
}