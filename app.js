// 앱 메인 객체
const app = {
    // 데이터
    vocabulary: [],
    learningWords: [],
    testWords: [],
    currentIndex: 0,
    testIndex: 0,
    testResults: [],
    
    // 설정
    settings: {
        sheetsUrl: '',
        dailyGoal: 15,
        passRate: 0.75,  // 75% 1차 통과
        masterRate: 0.90  // 90% 마스터
    },

    // 초기화
    init: function() {
        this.loadSettings();
        this.loadProgress();
        this.updateDashboard();
        this.loadHistory();
        
        // Google Sheets URL이 설정되어 있으면 데이터 로드
        if (this.settings.sheetsUrl) {
            this.loadVocabulary();
        } else {
            alert('설정에서 Google Sheets URL을 입력해주세요.');
            this.toggleSettings();
        }

        // Enter 키 이벤트
        document.getElementById('testInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.submitAnswer();
            }
        });
    },

    // 설정 로드
    loadSettings: function() {
        const saved = localStorage.getItem('agrivocab_settings');
        if (saved) {
            this.settings = JSON.parse(saved);
        }
        
        // 설정 UI 업데이트
        const urlInput = document.getElementById('sheetsUrl');
        if (urlInput) {
            urlInput.value = this.settings.sheetsUrl || '';
        }
    },

    // 설정 저장
    saveSettings: function() {
        const urlInput = document.getElementById('sheetsUrl');
        this.settings.sheetsUrl = urlInput.value.trim();
        
        localStorage.setItem('agrivocab_settings', JSON.stringify(this.settings));
        alert('설정이 저장되었습니다.');
        this.toggleSettings();
        this.loadVocabulary();
    },

    // 설정 패널 토글
    toggleSettings: function() {
        const panel = document.getElementById('settingsPanel');
        panel.classList.toggle('hidden');
    },

    // Google Sheets에서 단어 데이터 로드
    loadVocabulary: async function() {
        try {
            const sheetId = this.extractSheetId(this.settings.sheetsUrl);
            if (!sheetId) {
                alert('유효하지 않은 Google Sheets URL입니다.');
                return;
            }

            // Google Sheets를 CSV로 export
            const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
            
            const response = await fetch(csvUrl);
            const csvText = await response.text();
            
            this.vocabulary = this.parseCSV(csvText);
            console.log(`${this.vocabulary.length}개의 단어를 로드했습니다.`);
            
            if (this.vocabulary.length === 0) {
                alert('단어 데이터가 비어있습니다. Google Sheets를 확인해주세요.');
            }
            
            this.updateDashboard();
        } catch (error) {
            console.error('단어 로드 실패:', error);
            alert('단어 데이터를 불러오는데 실패했습니다. Google Sheets가 공개 설정되어 있는지 확인하세요.');
        }
    },

    // Sheet ID 추출
    extractSheetId: function(url) {
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : null;
    },

    // CSV 파싱 (탭 구분 지원)
    parseCSV: function(csv) {
        const lines = csv.split('\n');
        const words = [];
        
        // 헤더 스킵 (첫 줄)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // 탭이나 쉼표로 구분
            let cols;
            if (line.includes('\t')) {
                // TSV 형식
                cols = line.split('\t');
            } else {
                // CSV 형식 (따옴표 처리)
                cols = this.parseCSVLine(line);
            }
            
            if (cols.length >= 8) {
                words.push({
                    category: cols[0].trim().replace(/^"|"$/g, ''),
                    english: cols[1].trim().replace(/^"|"$/g, ''),
                    korean: cols[2].trim().replace(/^"|"$/g, ''),
                    example1: cols[3].trim().replace(/^"|"$/g, ''),
                    example2: cols[4].trim().replace(/^"|"$/g, ''),
                    example3: cols[5].trim().replace(/^"|"$/g, ''),
                    frequency: cols[6].trim().replace(/^"|"$/g, ''),
                    difficulty: parseInt(cols[7]) || 2
                });
            }
        }
        
        return words;
    },

    // CSV 라인 파싱 (쉼표로 구분, 따옴표 처리)
    parseCSVLine: function(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    },

    // 학습 진도 로드
    loadProgress: function() {
        const saved = localStorage.getItem('agrivocab_progress');
        if (saved) {
            this.progress = JSON.parse(saved);
        } else {
            this.progress = {
                learned: [],
                mastered: [],
                reviewPool: [],
                history: []
            };
        }
        
        // Set으로 변환 (JSON에서는 배열로 저장됨)
        this.progress.learned = new Set(this.progress.learned || []);
        this.progress.mastered = new Set(this.progress.mastered || []);
        this.progress.reviewPool = new Set(this.progress.reviewPool || []);
    },

    // 진도 저장
    saveProgress: function() {
        const toSave = {
            learned: Array.from(this.progress.learned),
            mastered: Array.from(this.progress.mastered),
            reviewPool: Array.from(this.progress.reviewPool),
            history: this.progress.history
        };
        localStorage.setItem('agrivocab_progress', JSON.stringify(toSave));
    },

    // 대시보드 업데이트
    updateDashboard: function() {
        document.getElementById('totalWords').textContent = this.vocabulary.length;
        document.getElementById('learnedWords').textContent = this.progress.mastered.size;
        
        // 오늘 학습한 단어 수
        const today = new Date().toDateString();
        const todayCount = this.progress.history.filter(h => 
            new Date(h.date).toDateString() === today
        ).length;
        document.getElementById('todayWords').textContent = todayCount;
        
        // 전체 정답률 계산
        if (this.progress.history.length > 0) {
            const totalTests = this.progress.history.reduce((sum, h) => sum + h.total, 0);
            const totalCorrect = this.progress.history.reduce((sum, h) => sum + h.correct, 0);
            const accuracy = totalTests > 0 ? Math.round((totalCorrect / totalTests) * 100) : 0;
            document.getElementById('accuracy').textContent = accuracy + '%';
        }
    },

    // 학습 기록 로드
    loadHistory: function() {
        const historyList = document.getElementById('historyList');
        const recent = this.progress.history.slice(-5).reverse();
        
        if (recent.length === 0) {
            historyList.innerHTML = '<p style="color: #7f8c8d;">아직 학습 기록이 없습니다.</p>';
            return;
        }
        
        historyList.innerHTML = recent.map(h => `
            <div class="history-item">
                <div>
                    <strong>${new Date(h.date).toLocaleDateString('ko-KR')}</strong>
                    <br>
                    <small>${h.type === 'review' ? '복습' : '신규학습'}</small>
                </div>
                <div style="text-align: right;">
                    <strong>${h.correct}/${h.total}</strong>
                    <br>
                    <small>${Math.round((h.correct/h.total)*100)}%</small>
                </div>
            </div>
        `).join('');
    },

    // 복습 테스트 시작
    startReview: function() {
        if (this.vocabulary.length === 0) {
            alert('단어 데이터가 로드되지 않았습니다. 설정을 확인해주세요.');
            return;
        }

        // 복습 풀에서 단어 선택 (없으면 learned에서)
        let reviewWords = Array.from(this.progress.reviewPool);
        
        if (reviewWords.length === 0) {
            const learnedWords = Array.from(this.progress.learned);
            reviewWords = learnedWords.slice(0, 15);
        }
        
        if (reviewWords.length === 0) {
            alert('복습할 단어가 없습니다. 먼저 신규 단어를 학습해주세요.');
            return;
        }
        
        // 단어 데이터 매칭
        this.testWords = reviewWords.map(index => this.vocabulary[index]).filter(w => w);
        
        // 최대 15개로 제한
        this.testWords = this.testWords.slice(0, 15);
        
        if (this.testWords.length === 0) {
            alert('복습할 단어가 없습니다.');
            return;
        }
        
        // 랜덤 셔플
        this.testWords = this.shuffleArray(this.testWords);
        
        this.testIndex = 0;
        this.testResults = [];
        
        this.showScreen('testScreen');
        this.showTestQuestion();
    },

    // 신규 단어 학습 시작
    startLearning: function() {
        if (this.vocabulary.length === 0) {
            alert('단어 데이터가 로드되지 않았습니다. 설정을 확인해주세요.');
            return;
        }

        // 아직 학습하지 않은 단어 찾기
        const unlearnedWords = this.vocabulary.filter((_, index) => 
            !this.progress.learned.has(index)
        );
        
        if (unlearnedWords.length === 0) {
            alert('모든 단어를 학습했습니다! 🎉');
            return;
        }
        
        // 최대 15개 선택
        this.learningWords = unlearnedWords.slice(0, 15);
        this.currentIndex = 0;
        
        this.showScreen('learningScreen');
        this.showWord();
    },

    // 단어 표시
    showWord: function() {
        const word = this.learningWords[this.currentIndex];
        if (!word) return;
        
        document.getElementById('wordCategory').textContent = word.category;
        document.getElementById('englishText').textContent = word.english;
        document.getElementById('wordKorean').textContent = word.korean;
        
        // 예문 표시
        document.querySelector('#example1 span').textContent = word.example1;
        document.querySelector('#example2 span').textContent = word.example2;
        document.querySelector('#example3 span').textContent = word.example3;
        
        // 진행률 업데이트
        const progress = ((this.currentIndex + 1) / this.learningWords.length) * 100;
        document.getElementById('progressBar').style.width = progress + '%';
        document.getElementById('progressText').textContent = 
            `${this.currentIndex + 1} / ${this.learningWords.length}`;
    },

    // TTS 발음
    speakWord: function() {
        const word = this.learningWords[this.currentIndex];
        if (!word) return;
        
        const utterance = new SpeechSynthesisUtterance(word.english);
        utterance.lang = 'en-US';
        utterance.rate = 0.8;
        speechSynthesis.speak(utterance);
    },

    // 예문 발음
    speakExample: function(num) {
        const word = this.learningWords[this.currentIndex];
        if (!word) return;
        
        const example = word[`example${num}`];
        const utterance = new SpeechSynthesisUtterance(example);
        utterance.lang = 'en-US';
        utterance.rate = 0.8;
        speechSynthesis.speak(utterance);
    },

    // 이전 단어
    previousWord: function() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.showWord();
        }
    },

    // 다음 단어
    nextWord: function() {
        if (this.currentIndex < this.learningWords.length - 1) {
            this.currentIndex++;
            this.showWord();
        }
    },

    // 학습 완료
    finishLearning: function() {
        // 학습한 단어들을 learned에 추가
        this.learningWords.forEach(word => {
            const index = this.vocabulary.indexOf(word);
            if (index !== -1) {
                this.progress.learned.add(index);
            }
        });
        
        this.saveProgress();
        this.updateDashboard();
        
        alert(`${this.learningWords.length}개의 단어를 학습했습니다! 이제 복습 테스트를 해보세요.`);
        this.returnToMain();
    },

    // 테스트 문제 표시
    showTestQuestion: function() {
        const word = this.testWords[this.testIndex];
        if (!word) return;
        
        document.getElementById('testKorean').textContent = word.korean;
        document.getElementById('testInput').value = '';
        document.getElementById('testInput').focus();
        
        // 피드백 숨기기
        document.getElementById('testFeedback').classList.add('hidden');
        
        // 진행률 업데이트
        const progress = ((this.testIndex + 1) / this.testWords.length) * 100;
        document.getElementById('testProgressBar').style.width = progress + '%';
        document.getElementById('testProgressText').textContent = 
            `${this.testIndex + 1} / ${this.testWords.length}`;
    },

    // 답안 제출
    submitAnswer: function() {
        const word = this.testWords[this.testIndex];
        const userAnswer = document.getElementById('testInput').value.trim().toLowerCase();
        const correctAnswer = word.english.toLowerCase();
        
        const isCorrect = userAnswer === correctAnswer;
        
        // 결과 저장
        this.testResults.push({
            word: word,
            userAnswer: userAnswer,
            isCorrect: isCorrect
        });
        
        // 피드백 표시
        const feedback = document.getElementById('testFeedback');
        const result = document.getElementById('feedbackResult');
        const answer = document.getElementById('feedbackAnswer');
        
        feedback.classList.remove('hidden');
        
        if (isCorrect) {
            result.textContent = '✅ 정답입니다!';
            result.className = 'feedback-result correct';
            answer.textContent = word.english;
        } else {
            result.textContent = '❌ 틀렸습니다';
            result.className = 'feedback-result wrong';
            answer.innerHTML = `정답: <strong>${word.english}</strong><br>입력: ${userAnswer}`;
        }
        
        // 입력창 비활성화
        document.getElementById('testInput').disabled = true;
        document.querySelector('.btn-submit').disabled = true;
    },

    // 다음 테스트
    nextTest: function() {
        // 입력창 활성화
        document.getElementById('testInput').disabled = false;
        document.querySelector('.btn-submit').disabled = false;
        
        this.testIndex++;
        
        if (this.testIndex >= this.testWords.length) {
            this.showTestSummary();
        } else {
            this.showTestQuestion();
        }
    },

    // 테스트 결과 요약
    showTestSummary: function() {
        const correct = this.testResults.filter(r => r.isCorrect).length;
        const total = this.testResults.length;
        const accuracy = Math.round((correct / total) * 100);
        
        // 결과 표시
        document.getElementById('correctCount').textContent = correct;
        document.getElementById('wrongCount').textContent = total - correct;
        document.getElementById('accuracyRate').textContent = accuracy + '%';
        
        // 화면 전환
        document.querySelector('.test-card').classList.add('hidden');
        document.getElementById('testSummary').classList.remove('hidden');
        
        // 오답 단어 처리
        const wrongWords = this.testResults
            .filter(r => !r.isCorrect)
            .map(r => this.vocabulary.indexOf(r.word));
        
        wrongWords.forEach(index => {
            if (index !== -1) {
                this.progress.reviewPool.add(index);
            }
        });
        
        // 정답률에 따라 마스터 처리
        if (accuracy >= this.settings.masterRate * 100) {
            this.testWords.forEach(word => {
                const index = this.vocabulary.indexOf(word);
                if (index !== -1) {
                    this.progress.mastered.add(index);
                    this.progress.reviewPool.delete(index);
                }
            });
        }
        
        // 기록 저장
        this.progress.history.push({
            date: new Date().toISOString(),
            type: 'review',
            correct: correct,
            total: total
        });
        
        this.saveProgress();
        this.updateDashboard();
        this.loadHistory();
    },

    // 메인 화면으로
    returnToMain: function() {
        this.showScreen('mainScreen');
        
        // 테스트 화면 초기화
        document.querySelector('.test-card').classList.remove('hidden');
        document.getElementById('testSummary').classList.add('hidden');
    },

    // 화면 전환
    showScreen: function(screenId) {
        ['mainScreen', 'learningScreen', 'testScreen'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
        });
        document.getElementById(screenId).classList.remove('hidden');
    },

    // 배열 셔플
    shuffleArray: function(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
};
