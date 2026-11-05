/*
  1) supabase-schema.sql을 Supabase SQL Editor에서 실행합니다.
  2) 아래 두 값을 Project Settings > API의 값으로 바꿉니다.
  anon key는 공개 가능한 키입니다. service_role 키는 절대 넣지 마세요.
*/
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
// 최초 로그인용 공통 비밀번호입니다. 실제 배포 전 이 값을 교체해 주세요.
// 이 값은 브라우저에 공개되므로, 첫 로그인 뒤 개인 비밀번호 변경을 강제합니다.
const INITIAL_PASSWORD = "Seminar2026!";
const STUDENT_ID_MIN = 1400;
const STUDENT_ID_MAX = 1421;

const TOPICS = [
  { name: "전체", color: "#273b54" },
  { name: "인문·사회", color: "#c88b4d" },
  { name: "자연과학", color: "#5f9274" },
  { name: "공학·컴퓨터", color: "#607fa8" },
  { name: "경제·경영", color: "#a47566" },
  { name: "예술·문화", color: "#9d769a" },
];

const SAMPLE_POSTS = [
  { id: "sample-1", title: "생성형 AI가 과제의 ‘사고 과정’을 정말 약화시킬까요?", body: "AI를 무조건 금지하거나 허용하는 방식 말고, 학생의 사고 과정을 더 선명하게 남길 수 있는 과제 설계가 있을지 궁금합니다. 초안–피드백–수정 기록을 평가에 넣는 방식은 어떨까요?\n\n참고로 OECD의 AI와 교육 보고서를 읽다가 이 질문을 하게 됐습니다.", topic: "인문·사회", author_name: "서윤", created_at: "2026-11-05T06:20:00.000Z", likes: 24, reply_count: 7 },
  { id: "sample-2", title: "실험 재현이 안 될 때, 어디까지를 ‘실패한 결과’로 봐야 할까요?", body: "학부 연구실에서 논문의 실험을 재현하고 있습니다. 하이퍼파라미터와 데이터 전처리를 맞췄지만 결과가 조금 다릅니다. 이런 차이를 기록하는 것 자체도 의미 있는 연구 결과가 될 수 있을까요?", topic: "자연과학", author_name: "민재", created_at: "2026-11-05T03:10:00.000Z", likes: 18, reply_count: 12 },
  { id: "sample-3", title: "‘좋은 알고리즘’의 기준은 정확도만으로 충분할까요?", body: "추천 시스템 과제를 하며 정확도 지표를 개선하고 있습니다. 하지만 설명 가능성, 계산 비용, 편향 문제를 함께 비교하려면 어떤 프레임을 써야 할지 막막합니다.", topic: "공학·컴퓨터", author_name: "도현", created_at: "2026-11-04T13:40:00.000Z", likes: 31, reply_count: 9 },
  { id: "sample-4", title: "행동경제학의 ‘넛지’는 개인의 자유를 침해하는가", body: "정책 설계에서 선택 구조를 바꾸는 일이 어디까지 정당화될 수 있는지 토론해 보고 싶습니다. 강제와 방임 사이에 실질적인 중간 지대가 있을까요?", topic: "경제·경영", author_name: "지우", created_at: "2026-11-04T08:20:00.000Z", likes: 15, reply_count: 5 },
];

const SAMPLE_REPLIES = {
  "sample-1": [
    { id: "r1", author_name: "하은", body: "초안과 수정 이유를 함께 제출하게 하는 방식이 좋아 보여요. 결과물보다 판단의 근거를 평가할 수 있으니까요.", created_at: "2026-11-05T07:15:00.000Z" },
    { id: "r2", author_name: "준서", body: "도구 사용 여부를 묻기보다, 어떤 부분에서 왜 도구를 썼는지 성찰문을 남기게 하면 학습 효과도 있을 것 같습니다.", created_at: "2026-11-05T07:48:00.000Z" },
  ],
  "sample-2": [{ id: "r3", author_name: "유진", body: "재현 조건의 차이를 표로 남겨 보세요. 이후 실험 설계에서 통제해야 할 변수를 찾는 데 큰 도움이 됩니다.", created_at: "2026-11-05T04:00:00.000Z" }],
};

let supabaseClient = null;
let posts = [...SAMPLE_POSTS];
let activeTopic = "전체";
let sortMode = "latest";
let currentPost = null;
let currentMember = null;
let likedPostIds = new Set(JSON.parse(localStorage.getItem("seminar-likes") || "[]"));

const $ = (selector) => document.querySelector(selector);
const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const topicData = (name) => TOPICS.find((topic) => topic.name === name) || TOPICS[0];

function relativeTime(date) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return "방금";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  return `${Math.floor(seconds / 86400)}일 전`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function renderStaticContent() {
  $("#interest-tags").innerHTML = ["교육", "AI", "심리학", "글쓰기"].map((name) => `<span class="tag">${name}</span>`).join("");
  $("#topic-strip").innerHTML = TOPICS.map((topic) => `<button class="topic-filter ${topic.name === activeTopic ? "active" : ""}" data-topic="${topic.name}">${topic.name}</button>`).join("");
  $("#post-topic").innerHTML = TOPICS.slice(1).map((topic) => `<option value="${topic.name}">${topic.name}</option>`).join("");
  $("#trending-list").innerHTML = ["공학·컴퓨터", "인문·사회", "자연과학", "경제·경영"].map((name, index) => `<div class="trend"><span class="trend-num">0${index + 1}</span><span class="trend-name">${name}</span><span class="trend-count">${[42, 31, 27, 19][index]} 토론</span></div>`).join("");
}

function renderFeed() {
  const displayPosts = (activeTopic === "전체" ? posts : posts.filter((post) => post.topic === activeTopic)).slice().sort((a, b) => sortMode === "latest" ? new Date(b.created_at) - new Date(a.created_at) : (b.likes || 0) - (a.likes || 0));
  $("#feed").innerHTML = displayPosts.map((post) => {
    const topic = topicData(post.topic);
    const isLiked = likedPostIds.has(String(post.id));
    return `<article class="post-card" data-id="${escapeHTML(post.id)}">
      <div class="post-meta"><i class="topic-dot" style="--topic-color:${topic.color}"></i><span>${escapeHTML(post.topic)}</span><span>·</span><span>${relativeTime(post.created_at)}</span></div>
      <h2 class="post-title">${escapeHTML(post.title)}</h2>
      <p class="post-excerpt">${escapeHTML(post.body)}</p>
      <div class="post-footer"><span class="reaction">◌ ${post.reply_count || 0}</span><span class="reaction">${isLiked ? "♥" : "♡"} ${post.likes || 0}</span><span class="author">${escapeHTML(post.author_name || "익명 학생")}</span></div>
    </article>`;
  }).join("");
  $("#empty-state").classList.toggle("hidden", displayPosts.length > 0);
}

function renderDetail(post, replies) {
  const topic = topicData(post.topic);
  const liked = likedPostIds.has(String(post.id));
  $("#post-detail").innerHTML = `<article class="detail-article">
    <div class="post-meta"><i class="topic-dot" style="--topic-color:${topic.color}"></i><span>${escapeHTML(post.topic)}</span><span>·</span><span>${relativeTime(post.created_at)}</span></div>
    <h1>${escapeHTML(post.title)}</h1>
    <div class="post-meta">${escapeHTML(post.author_name || "익명 학생")} · ${new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(post.created_at))}</div>
    <p class="detail-content">${escapeHTML(post.body)}</p>
    <div class="detail-actions"><button class="action-button ${liked ? "liked" : ""}" id="like-button">${liked ? "♥ 공감" : "♡ 공감"} ${post.likes || 0}</button><button class="action-button" id="copy-link">↗ 링크 복사</button></div>
  </article>`;
  $("#reply-count").textContent = `댓글 ${replies.length}`;
  $("#reply-list").innerHTML = replies.map((reply) => `<article class="reply"><div class="avatar-small">${escapeHTML((reply.author_name || "익").slice(0, 1))}</div><div><span class="reply-author">${escapeHTML(reply.author_name || "익명 학생")}</span><span class="reply-time">${relativeTime(reply.created_at)}</span></div><p>${escapeHTML(reply.body)}</p></article>`).join("") || `<p class="empty-replies">아직 댓글이 없습니다. 첫 답변을 남겨 보세요.</p>`;
}

async function fetchPosts() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from("posts").select("*").order("created_at", { ascending: false });
  if (error) { console.warn(error.message); showToast("서버 글을 불러오지 못해 예시 글을 표시합니다."); return; }
  posts = data;
  renderFeed();
}

async function getReplies(postId) {
  if (!supabaseClient || String(postId).startsWith("sample")) return SAMPLE_REPLIES[postId] || [];
  const { data, error } = await supabaseClient.from("comments").select("*").eq("post_id", postId).order("created_at");
  if (error) { showToast("댓글을 불러오지 못했습니다."); return []; }
  return data;
}

async function openDetail(post) {
  currentPost = post;
  const replies = await getReplies(post.id);
  renderDetail(post, replies);
  $("#feed-view").classList.add("hidden");
  $("#detail-view").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) {
    setAuthMessage("관리자가 Supabase 연결 정보를 아직 설정하지 않았습니다.");
    return;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) await startMemberSession(session.user);
}

function setAuthMessage(message = "") { $("#auth-message").textContent = message; }
function memberEmail(studentId) { return `student${studentId}@seminar.local`; }
function isValidStudentId(studentId) { const number = Number(studentId); return Number.isInteger(number) && number >= STUDENT_ID_MIN && number <= STUDENT_ID_MAX; }

async function startMemberSession(user) {
  const { data: profile, error } = await supabaseClient.from("profiles").select("student_id, must_change_password").eq("id", user.id).single();
  if (error || !profile) {
    await supabaseClient.auth.signOut();
    setAuthMessage("회원 정보를 찾을 수 없습니다. Supabase 스키마 설정을 확인해 주세요.");
    return;
  }
  currentMember = { id: user.id, ...profile };
  $("#member-avatar").textContent = String(profile.student_id).slice(-2);
  $("#auth-screen").classList.add("hidden");
  $("#site-header").classList.remove("hidden");
  $("#app-shell").classList.remove("hidden");
  $("#server-status").innerHTML = "<i></i> Supabase 연결됨";
  $("#server-status").classList.add("connected");
  await loadLikedPosts();
  await fetchPosts();
  if (profile.must_change_password) $("#password-dialog").showModal();
}

async function submitLogin(event) {
  event.preventDefault();
  setAuthMessage();
  if (!supabaseClient) { setAuthMessage("먼저 app.js에 Supabase 연결 정보를 입력해 주세요."); return; }
  const studentId = $("#student-id").value.trim();
  const password = $("#login-password").value;
  if (!isValidStudentId(studentId)) { setAuthMessage("학번은 1400부터 1421까지만 입력할 수 있습니다."); return; }
  const email = memberEmail(studentId);
  let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error && password === INITIAL_PASSWORD) {
    ({ data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { student_id: Number(studentId) } } }));
    if (!error && !data.session) {
      setAuthMessage("Supabase에서 Confirm email을 꺼야 첫 로그인을 바로 시작할 수 있습니다.");
      return;
    }
  }
  if (error || !data?.user) {
    setAuthMessage(password === INITIAL_PASSWORD ? "초기 가입에 실패했습니다. 이미 다른 비밀번호가 설정됐는지 확인해 주세요." : "학번 또는 비밀번호가 올바르지 않습니다.");
    return;
  }
  await startMemberSession(data.user);
}

async function submitNewPassword(event) {
  event.preventDefault();
  const password = $("#new-password").value;
  const confirmation = $("#new-password-confirm").value;
  const message = $("#password-message");
  message.textContent = "";
  if (password.length < 8) { message.textContent = "비밀번호는 8자 이상이어야 합니다."; return; }
  if (password !== confirmation) { message.textContent = "새 비밀번호가 일치하지 않습니다."; return; }
  const { error: passwordError } = await supabaseClient.auth.updateUser({ password });
  if (passwordError) { message.textContent = passwordError.message; return; }
  const { error: profileError } = await supabaseClient.rpc("complete_first_login");
  if (profileError) { message.textContent = "비밀번호는 변경됐지만 회원 상태 갱신에 실패했습니다. 새로고침 후 다시 시도해 주세요."; return; }
  currentMember.must_change_password = false;
  $("#password-form").reset();
  $("#password-dialog").close();
  showToast("회원 가입이 완료되었습니다. 환영합니다!");
}

async function logout() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  currentMember = null;
  posts = [...SAMPLE_POSTS];
  renderFeed();
  $("#site-header").classList.add("hidden");
  $("#app-shell").classList.add("hidden");
  $("#auth-screen").classList.remove("hidden");
  $("#login-form").reset();
  setAuthMessage();
}

function persistLikes() { localStorage.setItem("seminar-likes", JSON.stringify([...likedPostIds])); }

async function loadLikedPosts() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  const { data, error } = await supabaseClient.from("post_likes").select("post_id").eq("user_id", user.id);
  if (!error) likedPostIds = new Set(data.map((like) => String(like.post_id)));
}

async function toggleLike() {
  if (!currentPost) return;
  const id = String(currentPost.id);
  const alreadyLiked = likedPostIds.has(id);
  likedPostIds[alreadyLiked ? "delete" : "add"](id);
  currentPost.likes = Math.max(0, (currentPost.likes || 0) + (alreadyLiked ? -1 : 1));
  persistLikes();
  renderFeed();
  const replies = await getReplies(currentPost.id);
  renderDetail(currentPost, replies);
  if (supabaseClient && !id.startsWith("sample")) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const query = alreadyLiked
      ? supabaseClient.from("post_likes").delete().eq("post_id", currentPost.id).eq("user_id", user.id)
      : supabaseClient.from("post_likes").insert({ post_id: currentPost.id, user_id: user.id });
    const { error } = await query;
    if (error) {
      likedPostIds[alreadyLiked ? "add" : "delete"](id);
      currentPost.likes = Math.max(0, currentPost.likes + (alreadyLiked ? 1 : -1));
      persistLikes();
      renderFeed();
      renderDetail(currentPost, replies);
      showToast("공감 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }
}

async function submitPost(event) {
  event.preventDefault();
  const title = $("#post-title").value.trim();
  const body = $("#post-body").value.trim();
  const topic = $("#post-topic").value;
  if (!title || !body) return;
  const authorName = currentMember ? `${currentMember.student_id}번 학생` : "나";
  const newPost = { id: `local-${Date.now()}`, title, body, topic, author_name: authorName, created_at: new Date().toISOString(), likes: 0, reply_count: 0 };
  if (supabaseClient) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data, error } = await supabaseClient.from("posts").insert({ title, body, topic, author_name: authorName, user_id: user?.id }).select().single();
    if (error) { showToast(`발행하지 못했습니다: ${error.message}`); return; }
    posts.unshift(data);
  } else { posts.unshift(newPost); }
  renderFeed();
  $("#post-form").reset();
  $("#composer").close();
  showToast(supabaseClient ? "토론이 발행되었습니다." : "데모에 토론을 발행했습니다.");
}

async function submitReply(event) {
  event.preventDefault();
  const body = $("#reply-content").value.trim();
  if (!body || !currentPost) return;
  const authorName = currentMember ? `${currentMember.student_id}번 학생` : "나";
  const localReply = { id: `reply-${Date.now()}`, author_name: authorName, body, created_at: new Date().toISOString() };
  if (supabaseClient && !String(currentPost.id).startsWith("sample")) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { error } = await supabaseClient.from("comments").insert({ post_id: currentPost.id, body, author_name: authorName, user_id: user?.id });
    if (error) { showToast(`댓글을 남기지 못했습니다: ${error.message}`); return; }
    currentPost.reply_count = (currentPost.reply_count || 0) + 1;
  } else {
    SAMPLE_REPLIES[currentPost.id] = [...(SAMPLE_REPLIES[currentPost.id] || []), localReply];
    currentPost.reply_count = (currentPost.reply_count || 0) + 1;
  }
  $("#reply-content").value = "";
  renderFeed();
  renderDetail(currentPost, await getReplies(currentPost.id));
  showToast("답글을 남겼습니다.");
}

function setupEvents() {
  $("#login-form").addEventListener("submit", submitLogin);
  $("#password-form").addEventListener("submit", submitNewPassword);
  $("#password-dialog").addEventListener("cancel", (event) => event.preventDefault());
  $("#logout-button").addEventListener("click", logout);
  $("#topic-strip").addEventListener("click", (event) => { const button = event.target.closest("[data-topic]"); if (!button) return; activeTopic = button.dataset.topic; renderStaticContent(); renderFeed(); });
  $("#filter-button").addEventListener("click", () => { sortMode = sortMode === "latest" ? "popular" : "latest"; $("#filter-button").innerHTML = `${sortMode === "latest" ? "최신순" : "공감순"} <span>⌄</span>`; renderFeed(); });
  $("#feed").addEventListener("click", (event) => { const card = event.target.closest(".post-card"); if (card) openDetail(posts.find((post) => String(post.id) === card.dataset.id)); });
  $("#back-to-feed").addEventListener("click", () => { $("#detail-view").classList.add("hidden"); $("#feed-view").classList.remove("hidden"); currentPost = null; });
  $("#open-composer").addEventListener("click", () => $("#composer").showModal());
  $("#close-composer").addEventListener("click", () => $("#composer").close());
  $("#post-form").addEventListener("submit", submitPost);
  $("#reply-form").addEventListener("submit", submitReply);
  $("#post-detail").addEventListener("click", (event) => { if (event.target.closest("#like-button")) toggleLike(); if (event.target.closest("#copy-link")) { navigator.clipboard?.writeText(location.href); showToast("현재 링크를 복사했습니다."); } });
  $(".search-toggle").addEventListener("click", () => { $("#search-panel").classList.remove("hidden"); $("#search-input").focus(); });
  $("#search-input").addEventListener("input", (event) => { const query = event.target.value.trim().toLowerCase(); const matches = query ? posts.filter((post) => `${post.title} ${post.body} ${post.topic}`.toLowerCase().includes(query)) : []; $("#search-results").innerHTML = matches.map((post) => `<div class="search-item" data-search-id="${escapeHTML(post.id)}"><p>${escapeHTML(post.topic)}</p><h3>${escapeHTML(post.title)}</h3><p>${escapeHTML(post.body.slice(0, 90))}</p></div>`).join("") || (query ? "<p class='empty-replies'>검색 결과가 없습니다.</p>" : ""); });
  $("#search-results").addEventListener("click", (event) => { const item = event.target.closest("[data-search-id]"); if (!item) return; $("#search-panel").classList.add("hidden"); openDetail(posts.find((post) => String(post.id) === item.dataset.searchId)); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") $("#search-panel").classList.add("hidden"); });
  $("#manage-tags").addEventListener("click", () => showToast("관심 분야 설정은 다음 버전에서 추가됩니다."));
}

renderStaticContent();
renderFeed();
setupEvents();
initSupabase();
