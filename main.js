document.addEventListener('DOMContentLoaded', () => {
    // --- キャンバス背景（ポリゴン） ---
    const canvas = document.getElementById('bgCanvas');
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    let isBgAnimating = true;

    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.radius = Math.random() * 2 + 1;
        }
        update() {
            if (!isBgAnimating) return;
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#aaa';
            ctx.fill();
        }
    }

    function initParticles() {
        particles = [];
        const numParticles = Math.floor((width * height) / 10000);
        for (let i = 0; i < numParticles; i++) {
            particles.push(new Particle());
        }
    }
    initParticles();

    function drawLines() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(170, 170, 170, ${1 - dist / 150})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function animateBg() {
        if (isBgAnimating) {
            ctx.clearRect(0, 0, width, height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            drawLines();
        }
        requestAnimationFrame(animateBg);
    }
    animateBg();

    // --- ゲーム進行ロジック ---
    const answers = {
        'A': 'PLAY',
        'B': 'XMAS',
        'C': 'IDEA',
        'D': 'AQUA',
        'E': 'PIXEL'
    };

    let currentQuestion = 'A';
    let unlockedQuestions = ['A'];
    let solvedQuestions = []; // 正解済みの問題リスト
    let isXVisible = false;
    let xTimeoutIds = []; // タイムアウト解除用
    
    // 入力状態の保存用
    let userInputs = {
        'A': ['', '', '', ''],
        'B': ['', '', '', ''],
        'C': ['', '', '', ''],
        'D': ['', '', '', ''],
        'E': ['', '', '', '']
    };

    // UI elements
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const clearScreen = document.getElementById('clear-screen');
    const problemImage = document.getElementById('problem-image');
    const inputs = Array.from(document.querySelectorAll('.char-input'));
    const submitBtn = document.getElementById('submit-btn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const judgeMark = document.getElementById('judge-mark');
    const inputContainer = document.getElementById('input-container');
    const mainLogo = document.getElementById('main-logo');

    // Display sync helper
    function updateDisplay(input) {
        const display = input.nextElementSibling;
        if (display && display.classList.contains('char-display')) {
            display.textContent = input.value;
        }
    }

    // Hint elements
    const hintToggleBtn = document.getElementById('hint-toggle-btn');
    const hintLevelsContainer = document.getElementById('hint-levels');
    const hintLevelBtns = document.querySelectorAll('.hint-level-btn');
    const hintOverlays = [
        document.getElementById('hint-image-1'),
        document.getElementById('hint-image-2'),
        document.getElementById('hint-image-3')
    ];

    // 初期状態の表示同期
    inputs.forEach(updateDisplay);

    // Modal elements
    const howToPlayBtn = document.getElementById('how-to-play-btn');
    const howToPlayModal = document.getElementById('how-to-play-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    let isHintMode = false;
    let currentHintLevel = 0;

    // Start
    document.getElementById('start-button').addEventListener('click', () => {
        startScreen.classList.remove('active');
        // ゆったりと暗転させてからゲーム画面へ
        setTimeout(() => {
            window.scrollTo(0, 0); // 念のためトップへ
            gameScreen.classList.add('active');
            // inputs[0].focus(); // 自動フォーカスを削除
        }, 800);
    });

    // -- 入力ボックスの制御 --
    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            input.value = input.value.toUpperCase().replace(/[^A-Z]/g, '');
            updateDisplay(input); // 表示を更新
            inputs.forEach(i => i.classList.remove('incorrect-text')); // 打ったら赤文字解除

            if (input.value.length === 1 && index < inputs.length - 1) {
                setTimeout(() => {
                    inputs[index + 1].focus();
                }, 50); // 10msから50msに延長して、モバイルでの入力重複を防止
            }
            checkSubmitStatus();
        });

        input.addEventListener('keydown', (e) => {
            if (isXVisible) return; // X表示中はグローバルイベントで一括処理する

            const allFilled = inputs.every(i => i.value.length === 1);
            if (e.key === 'Backspace' && allFilled && !submitBtn.disabled) {
                if (index !== 3) {
                    e.preventDefault();
                    inputs.forEach(i => i.classList.remove('incorrect-text'));
                    inputs[3].focus();
                    inputs[3].value = '';
                    checkSubmitStatus();
                    return;
                }
            }

            if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                inputs.forEach(i => i.classList.remove('incorrect-text'));
                inputs[index - 1].focus();
            }
        });
    });

    // Enterキーとクイック入力の絶対グローバル処理
    document.addEventListener('keydown', (e) => {
        // モーダルが開いている時はEscで閉じる
        if (howToPlayModal.classList.contains('show')) {
            if (e.key === 'Escape') {
                closeModal();
            }
            return; // モーダル表示中は他の入力を受け付けない
        }

        if (!gameScreen.classList.contains('active') || document.body.classList.contains('scanning')) return;

        if (e.key === 'Enter') {
            if (!submitBtn.disabled && submitBtn.style.display !== 'none') {
                submitBtn.click();
            }
            return;
        }

        // --- X表示中の特別オーバーライド処理 ---
        if (isXVisible) {
            if ((e.key.length === 1 && /[a-zA-Z]/.test(e.key)) || e.key === 'Backspace') {
                e.preventDefault();
                // 1. バツを消す
                cleanXTimeouts();
                judgeMark.className = '';
                judgeMark.textContent = '';
                judgeMark.style.opacity = '0';
                inputContainer.classList.remove('shake');
                inputs.forEach(i => i.classList.remove('incorrect-text'));
                isXVisible = false;

                if (e.key === 'Backspace') {
                    // backspace→一番後ろの文字を1文字消す
                    const reversedInputs = Array.from(inputs).reverse();
                    const filledInput = reversedInputs.find(i => i.value !== '');
                    if (filledInput) {
                        filledInput.value = '';
                        updateDisplay(filledInput);
                        filledInput.focus();
                    } else {
                        inputs[0].focus();
                    }
                } else {
                    // なにかキーを入力→全て消して１文字目を入力
                    inputs.forEach(i => {
                        i.value = '';
                        updateDisplay(i);
                    });
                    inputs[0].value = e.key.toUpperCase();
                    updateDisplay(inputs[0]);
                    inputs[0].focus(); // 1つ先ではなく、入力した本人にフォーカス（重複防止）
                }
                checkSubmitStatus();
                return;
            }
        }
        // ------------------------------------

        const isInputFocused = document.activeElement.tagName === 'INPUT';

        if (submitBtn.style.display !== 'none') {
            // 文字にフォーカスされていなくても強制的に文字入力
            if (!isInputFocused && e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
                const emptyInput = Array.from(inputs).find(i => i.value === '');
                if (emptyInput) {
                    e.preventDefault();
                    inputs.forEach(i => i.classList.remove('incorrect-text'));
                    emptyInput.value = e.key.toUpperCase();
                    updateDisplay(emptyInput);
                    emptyInput.focus(); // 1つ先ではなく、入力した本人にフォーカス（重複防止）
                    checkSubmitStatus();
                }
            }

            // フォーカスされていなくても強制的にBackSpaceで1文字消去
            if (!isInputFocused && e.key === 'Backspace') {
                const reversedInputs = Array.from(inputs).reverse();
                const filledInput = reversedInputs.find(i => i.value !== '');
                if (filledInput) {
                    e.preventDefault();
                    inputs.forEach(i => i.classList.remove('incorrect-text'));
                    filledInput.value = '';
                    updateDisplay(filledInput);
                    filledInput.focus();
                    checkSubmitStatus();
                }
            }
        }
    });

    function checkSubmitStatus() {
        if (solvedQuestions.includes(currentQuestion)) {
            submitBtn.disabled = true;
            submitBtn.style.display = 'none';
            return;
        }
        submitBtn.style.display = 'block';
        const allFilled = inputs.every(input => input.value.length === 1);
        submitBtn.disabled = !allFilled || document.body.classList.contains('scanning');
    }

    // --- ヒント機能のロジック ---
    function resetHints() {
        isHintMode = false;
        currentHintLevel = 0;
        hintToggleBtn.classList.remove('active');
        hintLevelsContainer.classList.remove('show');
        hintLevelBtns.forEach(btn => btn.classList.remove('selected'));
        hintOverlays.forEach(img => {
            img.classList.remove('show');
            img.src = '';
        });

        // 問題Cの場合、ヒントを消したら元の画像に戻す
        if (currentQuestion === 'C') {
            problemImage.src = `QuestionC.png`;
        }

        // 全問題共通：ロゴを元に戻す（D3ヒント対策）
        mainLogo.src = 'logo.png';
        mainLogo.classList.remove('logo-pulse');
    }

    function setHintLevel(level) {
        // 同じレベルをもう一度押したらそのレベルをオフにする（トグル）
        if (currentHintLevel === level) {
            currentHintLevel = 0;
        } else {
            currentHintLevel = level;
        }

        // ボタンの選択状態を更新
        hintLevelBtns.forEach(btn => {
            const btnLevel = parseInt(btn.dataset.level);
            if (btnLevel === currentHintLevel) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        // 問題ごとの出し分けロジック
        if (currentQuestion === 'C') {
            // --- 問題C: 画像そのものを差し替える ---
            if (currentHintLevel > 0) {
                problemImage.src = `${currentQuestion}${currentHintLevel}.png`;
            } else {
                problemImage.src = `QuestionC.png`;
            }
            // 重ね合わせ用のオーバーレイはすべて隠す
            hintOverlays.forEach(img => img.classList.remove('show'));

        } else if (currentQuestion === 'B') {
            // --- 問題B: 選択したレベルのヒント画像のみを重ねる ---
            hintOverlays.forEach((img, index) => {
                const levelNum = index + 1;
                if (levelNum === currentHintLevel) {
                    img.src = `${currentQuestion}${levelNum}.png`;
                    img.classList.add('show');
                } else {
                    img.classList.remove('show');
                }
            });

        } else {
            // --- 問題A, D, E: 指定レベルまでのすべてのヒント画像を重ねる ---
            hintOverlays.forEach((img, index) => {
                const levelNum = index + 1;
                if (levelNum <= currentHintLevel) {
                    img.src = `${currentQuestion}${levelNum}.png`;
                    img.classList.add('show');
                } else {
                    img.classList.remove('show');
                }
            });

            // 問題DのHINT3のみ、タイトルロゴを差し替えて点滅させる特別処理
            if (currentQuestion === 'D' && currentHintLevel === 3) {
                mainLogo.src = 'D3.png';
                mainLogo.classList.add('logo-pulse');
                // 問題画像上のD3オーバーレイは表示させないようにする
                hintOverlays[2].classList.remove('show');
            } else {
                mainLogo.src = 'logo.png';
                mainLogo.classList.remove('logo-pulse');
            }
        }
    }

    hintToggleBtn.addEventListener('click', () => {
        isHintMode = !isHintMode;
        if (isHintMode) {
            hintToggleBtn.classList.add('active');
            hintLevelsContainer.classList.add('show');
        } else {
            resetHints();
        }
    });

    hintLevelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const level = parseInt(btn.dataset.level);
            setHintLevel(level);
        });
    });

    // --- 操作説明モーダルのロジック ---
    function openModal() {
        if (document.body.classList.contains('scanning')) return; // スキャン中は開かない
        howToPlayModal.classList.add('show');
    }

    function closeModal() {
        howToPlayModal.classList.remove('show');
    }

    howToPlayBtn.addEventListener('click', openModal);
    modalCloseBtn.addEventListener('click', closeModal);

    // 背景クリックで閉じる
    howToPlayModal.addEventListener('click', (e) => {
        if (e.target === howToPlayModal) {
            closeModal();
        }
    });
    // ----------------------------
    // ----------------------------

    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const q = btn.dataset.q;
            if (unlockedQuestions.includes(q) && !document.body.classList.contains('scanning')) {
                if (currentQuestion !== q) {
                    switchQuestion(q);
                }
            }
        });
    });

    function cleanXTimeouts() {
        xTimeoutIds.forEach(id => clearTimeout(id));
        xTimeoutIds = [];
    }

    function switchQuestion(q) {
        if (q === currentQuestion) return;

        cleanXTimeouts();
        resetHints(); // 問題を切り替えたらヒントをリセット
        inputContainer.classList.remove('shake');

        // タブ切り替え前に現在の状態を保存
        if (!solvedQuestions.includes(currentQuestion)) {
            userInputs[currentQuestion] = inputs.map(i => i.value);
        }

        const qKeys = ['A', 'B', 'C', 'D', 'E'];
        const oldIndex = qKeys.indexOf(currentQuestion);
        const newIndex = qKeys.indexOf(q);
        const isForward = newIndex > oldIndex;

        currentQuestion = q;
        tabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.q === q) btn.classList.add('active');
        });

        // 画像のスライドアニメーション処理
        const outClass = isForward ? 'slide-out-left' : 'slide-out-right';
        const inClass = isForward ? 'slide-in-from-right' : 'slide-in-from-left';

        problemImage.classList.add(outClass);

        setTimeout(() => {
            problemImage.src = `Question${q}.png`;
            problemImage.classList.remove(outClass);
            problemImage.classList.add(inClass);

            // 強制reflow
            void problemImage.offsetWidth;

            problemImage.classList.remove(inClass);
        }, 200);

        if (solvedQuestions.includes(q)) {
            // すでに解かれている問題
            inputs.forEach((input, idx) => {
                input.value = answers[q][idx];
                updateDisplay(input);
                input.disabled = true;
                input.classList.add('solved');
                input.classList.remove('incorrect-text');
            });
            judgeMark.className = 'correct';
            judgeMark.textContent = '〇';
            judgeMark.style.opacity = '1';

            isXVisible = false;
            checkSubmitStatus();
        } else {
            // まだ解かれていない問題
            inputs.forEach((input, idx) => {
                input.value = userInputs[q][idx];
                updateDisplay(input);
                input.disabled = false;
                input.classList.remove('solved');
                input.classList.remove('incorrect-text');
            });
            judgeMark.className = '';
            judgeMark.textContent = '';
            judgeMark.style.opacity = '0';

            isXVisible = false;
            checkSubmitStatus();
            
            // 自動フォーカスを削除
        }
    }

    function unlockNextQuestion(currentQ) {
        const qKeys = Object.keys(answers);
        const currentIndex = qKeys.indexOf(currentQ);
        if (currentIndex < qKeys.length - 1) {
            const nextQ = qKeys[currentIndex + 1];
            if (!unlockedQuestions.includes(nextQ)) {
                unlockedQuestions.push(nextQ);
                const nextTab = document.querySelector(`.tab-btn[data-q="${nextQ}"]`);
                nextTab.classList.remove('locked');
                return nextQ;
            }
        }
        return null;
    }

    // Submit Logic
    submitBtn.addEventListener('click', async () => {
        if (submitBtn.disabled) return;

        const currentInput = inputs.map(i => i.value).join('');

        // Disable UI during scanning
        inputs.forEach(i => i.disabled = true);
        submitBtn.disabled = true;

        // 全てのアニメーションを一時停止させる（背景とCSS）
        isBgAnimating = false;
        cleanXTimeouts(); // 判定のタイマーを止めて凍結

        document.body.classList.add('scanning');

        const scanBar = document.getElementById('scan-bar');
        scanBar.classList.add('scan-active');

        // スキャン演出(1.5s)を待機
        await new Promise(r => setTimeout(r, 1500));

        // スキャン終了
        document.body.classList.remove('scanning');
        scanBar.classList.remove('scan-active');
        isBgAnimating = true;

        let evalString = currentInput;
        let isPixelCorrect = false;

        // E問題のPIXELギミック：isXVisibleがtrueのままsubmitに到達した場合
        if (currentQuestion === 'E' && evalString === 'PIEL' && isXVisible) {
            evalString = 'PIXEL';
            isPixelCorrect = true;
        }

        if (evalString === answers[currentQuestion]) {
            // Correct
            if (isPixelCorrect) {
                // E問題の特別演出：×を残したまま大きな〇を上に表示する
                judgeMark.textContent = '×';
                judgeMark.className = 'pixel-correct';
            } else {
                judgeMark.textContent = '〇';
                judgeMark.className = 'correct';
            }
            judgeMark.style.opacity = '1';
            judgeMark.classList.remove('fade-out');
            inputContainer.classList.remove('shake');
            isXVisible = false;

            if (!solvedQuestions.includes(currentQuestion)) {
                solvedQuestions.push(currentQuestion);
                inputs.forEach(input => input.classList.add('solved'));
            }

            checkSubmitStatus(); // ボタンを非表示に

            setTimeout(() => {
                if (currentQuestion === 'E') {
                    window.scrollTo({ top: 0, behavior: 'smooth' }); // 最後は優雅にトップへ
                    gameScreen.classList.remove('active');
                    clearScreen.classList.add('active');
                } else {
                    const nextQ = unlockNextQuestion(currentQuestion);
                    if (nextQ) {
                        switchQuestion(nextQ);
                    }
                }
            }, 1000);

        } else {
            // Incorrect
            judgeMark.textContent = '×';
            judgeMark.className = 'incorrect';
            judgeMark.style.opacity = '1';
            judgeMark.classList.remove('fade-out');
            isXVisible = true;

            // Re-trigger shake 
            inputContainer.classList.remove('shake');
            void inputContainer.offsetWidth; // reflow
            inputContainer.classList.add('shake');

            inputs.forEach(i => {
                i.disabled = false;
                i.classList.add('incorrect-text'); // 不正解時に赤くする
            });
            checkSubmitStatus(); // enabled allowing click while X is visible

            // Manage fade out sequence
            xTimeoutIds.push(setTimeout(() => {
                inputContainer.classList.remove('shake');

                xTimeoutIds.push(setTimeout(() => {
                    judgeMark.classList.add('fade-out'); // start 0.3s CSS opacity animation

                    xTimeoutIds.push(setTimeout(() => {
                        judgeMark.className = '';
                        judgeMark.textContent = '';
                        judgeMark.style.opacity = '0';
                        isXVisible = false;
                    }, 300));
                }, 2000)); // 元は500。+1.5秒して2000に変更
            }, 400));
        }
    });

    document.getElementById('restart-button').addEventListener('click', () => {
        location.reload();
    });
});
