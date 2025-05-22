document.addEventListener('DOMContentLoaded', () => {
    console.log("Karta Frontend JS Loaded");
    const API_BASE_URL = '/api'; // Utilise un chemin relatif car le frontend est servi par le même serveur

    // --- Fonction utilitaire pour les notifications Toast SweetAlert2 ---
    const Toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    function showToast(type, message) {
        Toast.fire({
            icon: type, // 'success', 'error', 'warning', 'info', 'question'
            title: message
        });
    }

    // --- Fonctions utilitaires pour l'API ---
    async function apiCall(endpoint, method = 'GET', body = null, token = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const config = {
            method: method,
            headers: headers,
        };
        if (body) {
            config.body = JSON.stringify(body);
        }
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                
                if (response.status === 401 || response.status === 403) {
                    console.warn(`[apiCall] Erreur ${response.status} sur ${endpoint}. Tentative de déconnexion.`);
                    const currentPath = window.location.pathname;
                    let context = getUserType(); // Utiliser le type d'utilisateur stocké si possible
                    if (!context) { // Si non défini, essayer de deviner par le chemin
                        context = currentPath.includes('merchant_dashboard.html') || currentPath.includes('merchant_login.html') ? 'merchant' : 'user';
                    }
                    logout(context); 
                    // Lancer une erreur pour arrêter le flux d'exécution de la fonction appelante.
                    throw new Error(`AuthError: ${errorData.message || response.statusText}`); 
                }
                throw new Error(errorData.message || `Erreur HTTP: ${response.status}`);
            }
            if (response.status === 204) { // No Content
                return null;
            }
            return await response.json();
        } catch (error) {
            console.error(`Erreur API (${method} ${endpoint}):`, error);
            // Si l'erreur est une AuthError, la déconnexion a déjà été initiée.
            // Il est important de la propager pour que les .then/.catch de l'appelant ne s'exécutent pas comme si tout allait bien.
            throw error; 
        }
    }

    function saveToken(token, userType) {
        localStorage.setItem('karta_token', token);
        localStorage.setItem('karta_user_type', userType); // Crucial pour identifier le type d'utilisateur
        console.log(`Token sauvegardé. Type: ${userType}`);
    }

    function getToken() {
        return localStorage.getItem('karta_token');
    }

    function getUserType() {
        return localStorage.getItem('karta_user_type');
    }

    function logout(userContext = null) { // userContext peut être 'user' ou 'merchant'
        console.log(`Déconnexion demandée. Contexte: ${userContext}`);
        const currentPath = window.location.pathname;
        localStorage.removeItem('karta_token');
        localStorage.removeItem('karta_user_type');
        localStorage.removeItem('karta_user_info');
        localStorage.removeItem('karta_merchant_info');
        
        // Déterminer la page de redirection
        let redirectTo = '/index.html'; // Défaut pour client
        if (userContext === 'merchant') {
            redirectTo = '/merchant_login.html';
        } else if (currentPath.includes('merchant_dashboard.html') || currentPath.includes('merchant_login.html')) {
            // Si le contexte n'est pas explicitement 'user', mais qu'on est sur une page marchand, rediriger vers login marchand
            redirectTo = '/merchant_login.html';
        }
        
        window.location.href = redirectTo;
    }
    
    // Attacher la fonction logout aux boutons de déconnexion
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) logoutButton.addEventListener('click', () => logout('user'));
    const merchantLogoutButton = document.getElementById('merchantLogoutButton');
    if (merchantLogoutButton) merchantLogoutButton.addEventListener('click', () => logout('merchant'));


    // --- Gestion des formulaires d'authentification ---
    const loginFormEl = document.getElementById('loginForm');
    const registerFormEl = document.getElementById('registerForm');
    const merchantLoginFormEl = document.getElementById('merchantLoginForm');
    const merchantRegisterFormEl = document.getElementById('merchantRegisterForm');

    if (loginFormEl) {
        loginFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            try {
                const data = await apiCall('/auth/login/user', 'POST', { email, password });
                saveToken(data.token, 'user');
                localStorage.setItem('karta_user_info', JSON.stringify({ userId: data.userId, name: data.name, email: data.email }));
                showToast('success', 'Connexion réussie !');
                window.location.href = '/dashboard.html';
            } catch (error) {
                showToast('error', error.message || 'Erreur de connexion.');
            }
        });
    }

    if (registerFormEl) {
        registerFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            try {
                await apiCall('/auth/register/user', 'POST', { name, email, password });
                showToast('success', 'Inscription réussie ! Vous pouvez maintenant vous connecter.');
                // Optionnel: basculer vers le formulaire de connexion
                registerFormEl.style.display = 'none';
                if(loginFormEl) loginFormEl.style.display = 'block';
                loginFormEl.reset(); // Vider le formulaire de connexion
                registerFormEl.reset(); // Vider le formulaire d'inscription
            } catch (error) {
                showToast('error', error.message || 'Erreur d\'inscription.');
            }
        });
    }

    if (merchantLoginFormEl) {
        merchantLoginFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('merchantEmail').value;
            const password = document.getElementById('merchantPassword').value;
            try {
                const data = await apiCall('/auth/login/merchant', 'POST', { email, password });
                saveToken(data.token, 'merchant'); // 'merchant' est bien passé ici
                localStorage.setItem('karta_merchant_info', JSON.stringify(data)); 
                showToast('success', 'Connexion commerçant réussie !');
                window.location.href = '/merchant_dashboard.html'; 
            } catch (error) {
                // Si l'erreur est AuthError, la déconnexion a déjà été gérée par apiCall
                if (!error.message.startsWith("AuthError:")) {
                    showToast('error', error.message || 'Erreur de connexion commerçant.');
                }
            }
        });
    }

    if (merchantRegisterFormEl) {
        merchantRegisterFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('merchantRegName').value;
            const email = document.getElementById('merchantRegEmail').value;
            const password = document.getElementById('merchantRegPassword').value;
            // Vous pourriez ajouter un champ pour loyalty_program_type ici si nécessaire
            try {
                await apiCall('/auth/register/merchant', 'POST', { name, email, password /*, loyalty_program_type: 'points' */ });
                showToast('success', 'Inscription du commerce réussie ! Vous pouvez maintenant vous connecter.');
                 // Optionnel: basculer vers le formulaire de connexion
                merchantRegisterFormEl.style.display = 'none';
                if(merchantLoginFormEl) merchantLoginFormEl.style.display = 'block';
                merchantLoginFormEl.reset();
                merchantRegisterFormEl.reset();
            } catch (error) {
                showToast('error', error.message || 'Erreur d\'inscription du commerce.');
            }
        });
    }

    // Logique pour basculer entre les formulaires de connexion et d'inscription (index.html)
    const loginLink = document.querySelector('a[href="#login"]');
    const registerLink = document.querySelector('a[href="#register"]');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (registerLink && loginForm && registerForm) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
        });
    }
    if (loginLink && loginForm && registerForm) {
        loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
        });
    }
    
    // Logique pour basculer entre les formulaires de connexion et d'inscription (merchant_login.html)
    const merchantLoginLink = document.querySelector('a[href="#loginMerchant"]');
    const merchantRegisterLink = document.querySelector('a[href="#registerMerchant"]');
    const merchantLoginForm = document.getElementById('merchantLoginForm');
    const merchantRegisterForm = document.getElementById('merchantRegisterForm');

    if (merchantRegisterLink && merchantLoginForm && merchantRegisterForm) {
        merchantRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            merchantLoginForm.style.display = 'none';
            merchantRegisterForm.style.display = 'block';
        });
    }
    if (merchantLoginLink && merchantLoginForm && merchantRegisterForm) {
         merchantLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            merchantRegisterForm.style.display = 'none';
            merchantLoginForm.style.display = 'block';
        });
    }

    // Vérifier si l'utilisateur est sur une page protégée sans token
    const protectedUserPages = ['/dashboard.html'];
    const protectedMerchantPages = ['/merchant_dashboard.html'];
    const currentPath = window.location.pathname;

    if (protectedUserPages.includes(currentPath) && (!getToken() || getUserType() !== 'user')) {
        logout('user'); // Redirige si pas de token ou mauvais type
    }
    if (protectedMerchantPages.includes(currentPath) && (!getToken() || getUserType() !== 'merchant')) {
        logout('merchant'); // Redirige si pas de token ou mauvais type
    }

    // --- Logique pour le modal de la carte détaillée ---
    const detailedCardModal = document.getElementById('detailedCardModal');
    const detailedCardModalClose = document.querySelector('.detailed-card-modal-close');
    const detailedCardLogoEl = document.getElementById('detailedCardLogo');
    const detailedCardMerchantNameEl = document.getElementById('detailedCardMerchantName');
    const detailedCardQrCodeEl = document.getElementById('detailedCardQrCode');
    const detailedCardIdentifierTextEl = document.getElementById('detailedCardIdentifierText');
    const detailedCardOfferSectionEl = document.getElementById('detailedCardOfferSection');
    const detailedCardOfferDescriptionEl = document.getElementById('detailedCardOfferDescription');
    let currentDetailQrCodeInstance = null;

    function showDetailedCardModal(cardData) {
        if (!detailedCardModal || !cardData) return;

        detailedCardLogoEl.src = cardData.logoUrl || cardData.logo_url || 'assets/logo_placeholder.png';
        detailedCardLogoEl.alt = `Logo ${cardData.merchantName || cardData.merchant_name}`;
        detailedCardMerchantNameEl.textContent = cardData.merchantName || cardData.merchant_name;
        detailedCardIdentifierTextEl.textContent = cardData.card_identifier;

        // Nettoyer l'ancien QR code s'il existe
        detailedCardQrCodeEl.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            currentDetailQrCodeInstance = new QRCode(detailedCardQrCodeEl, {
                text: cardData.card_identifier,
                width: 160, // Taille du QR code dans le modal
                height: 160,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
            detailedCardQrCodeEl.textContent = "QR Code indisponible.";
        }

        // Gérer l'affichage de la section offre en utilisant les données de l'API
        if (cardData.has_active_offer && cardData.active_offer_description && detailedCardOfferSectionEl && detailedCardOfferDescriptionEl) {
            detailedCardOfferDescriptionEl.textContent = cardData.active_offer_description;
            detailedCardOfferSectionEl.style.display = 'block';
        } else if (detailedCardOfferSectionEl) {
            detailedCardOfferSectionEl.style.display = 'none';
        }
        
        detailedCardModal.style.display = "block";
    }

    function closeDetailedCardModal() {
        if (!detailedCardModal) return;
        detailedCardModal.style.display = "none";
        detailedCardQrCodeEl.innerHTML = ''; // Nettoyer le QR code
        if (currentDetailQrCodeInstance) {
            currentDetailQrCodeInstance = null;
        }
        if (detailedCardOfferSectionEl) { // Cacher aussi la section offre
            detailedCardOfferSectionEl.style.display = 'none';
        }
    }

    if (detailedCardModalClose) {
        detailedCardModalClose.addEventListener('click', closeDetailedCardModal);
    }
    // Fermer le modal si on clique en dehors du contenu du modal
    window.addEventListener('click', (event) => {
        if (event.target === detailedCardModal) {
            closeDetailedCardModal();
        }
    });

    // --- Logique pour dashboard.html ---
    if (document.getElementById('loyaltyCardsList')) {
        if (getToken() && getUserType() === 'user') {
            loadUserLoyaltyCards();
        } else {
            logout('user'); // Si pas de token ou mauvais type, déconnexion
        }

        const addCardButton = document.getElementById('submitAddCard');
        if (addCardButton) {
            addCardButton.addEventListener('click', handleAddCardWrapper); // Wrapper pour gérer la recherche et l'ajout
        }
        const merchantSearchInput = document.getElementById('merchantSearch');
        if (merchantSearchInput) {
            merchantSearchInput.addEventListener('input', debounce(handleMerchantSearch, 300));
        }
    }

    // --- Logique pour merchant_dashboard.html (Espace Commerçant) ---
    const merchantDashboardRootElement = document.getElementById('merchantNameDisplay');

    if (merchantDashboardRootElement) {
        // Éléments DOM spécifiques au tableau de bord commerçant
        // Déclarer TOUS les éléments DOM ici, AVANT les définitions de fonctions
        const merchantNameDisplayEl = merchantDashboardRootElement;
        const merchantProfileNameInput = document.getElementById('merchantProfileName');
        const merchantLogoInput = document.getElementById('merchantLogo');
        const loyaltyTypeSelect = document.getElementById('loyaltyType');
        const defaultPointsPerScanInput = document.getElementById('defaultPointsPerScan');
        const activeClientsCountSpan = document.getElementById('activeClientsCount');
        const totalVisitsCountSpan = document.getElementById('totalVisitsCount');
        const pointsToAddInput = document.getElementById('pointsToAdd');
        const clientCardIdentifierInput = document.getElementById('clientCardIdentifier');
        const stampsToAddInput = document.getElementById('stampsToAdd');

        // Éléments pour la gestion des offres
        const merchantOfferForm = document.getElementById('merchantOfferForm');
        const offerIsActiveCheckbox = document.getElementById('offerIsActive'); // Déclaré ici
        const offerConfigurationDetailsDiv = document.getElementById('offerConfigurationDetails');
        const offerSystemStatusSpan = document.getElementById('offerSystemStatus');
        const offerTriggerPointsInput = document.getElementById('offerTriggerPoints');
        const offerDescriptionInput = document.getElementById('offerDescription');

        // Éléments pour le scanner QR Code
        const initiateScanButton = document.getElementById('initiateScanButton');
        const qrReaderElement = document.getElementById('qr-reader');
        const qrReaderResultsElement = document.getElementById('qr-reader-results');
        let html5QrCodeInstance = null;

        // Éléments pour la section Clients
        const clientSearchInputEl = document.getElementById('clientSearchInput');
        const scanClientCardForSearchButtonEl = document.getElementById('scanClientCardForSearchButton');
        const clientSearchResultsEl = document.getElementById('clientSearchResults');
        const selectedClientDetailsEl = document.getElementById('selectedClientDetails');
        const noClientSelectedEl = document.getElementById('noClientSelected');
        const clientDetailNameEl = document.getElementById('clientDetailName');
        const clientDetailEmailEl = document.getElementById('clientDetailEmail');
        const clientDetailCardIdentifierEl = document.getElementById('clientDetailCardIdentifier');
        const clientDetailPointsInputEl = document.getElementById('clientDetailPoints');
        const updateClientPointsButtonEl = document.getElementById('updateClientPointsButton');
        const clientDetailQrCodeEl = document.getElementById('clientDetailQrCode');
        const clientDetailOffersListEl = document.getElementById('clientDetailOffersList');
        const noClientOffersEl = document.getElementById('noClientOffers');
        let selectedLoyaltyCardId = null;

        // Éléments pour la sidebar et la navigation de section
        const sidebarLinks = document.querySelectorAll('.sidebar-link');
        const contentSections = document.querySelectorAll('.content-section');
        const menuToggle = document.getElementById('menu-toggle'); // Pour le toggle de la sidebar

        // Fonctions spécifiques au tableau de bord commerçant
        async function loadMerchantDashboardData() {
            console.log("Chargement des données du commerçant...");
            const token = getToken();
            // Le type est déjà vérifié avant d'appeler cette fonction

            try {
                // Charger les infos du profil
                const merchantInfoFromStorage = JSON.parse(localStorage.getItem('karta_merchant_info'));
                const profileData = await apiCall('/merchants/profile', 'GET', null, token); 
                
                if (merchantNameDisplayEl) merchantNameDisplayEl.textContent = profileData.name || merchantInfoFromStorage?.name;
                if (merchantProfileNameInput) merchantProfileNameInput.value = profileData.name || merchantInfoFromStorage?.name;
                if (merchantLogoInput) merchantLogoInput.value = profileData.logo_url || merchantInfoFromStorage?.logoUrl;
                if (loyaltyTypeSelect) loyaltyTypeSelect.value = profileData.loyalty_program_type || merchantInfoFromStorage?.loyaltyProgramType;
                if (defaultPointsPerScanInput) defaultPointsPerScanInput.value = profileData.default_points_per_scan !== undefined ? profileData.default_points_per_scan : (merchantInfoFromStorage?.default_points_per_scan !== undefined ? merchantInfoFromStorage.default_points_per_scan : 1);
                
                // Charger les données des offres et mettre à jour l'indicateur d'état
                // Vérifier que les éléments existent avant de les utiliser
                if (offerIsActiveCheckbox && offerConfigurationDetailsDiv && offerSystemStatusSpan && offerTriggerPointsInput && offerDescriptionInput) {
                    const isActive = profileData.offer_is_active || false;
                    offerIsActiveCheckbox.checked = isActive; // Utilisation de offerIsActiveCheckbox
                    offerTriggerPointsInput.value = profileData.offer_trigger_points || '';
                    offerDescriptionInput.value = profileData.offer_description || '';
                    offerConfigurationDetailsDiv.style.display = isActive ? 'block' : 'none';

                    if (isActive) {
                        offerSystemStatusSpan.textContent = 'Activé';
                        offerSystemStatusSpan.className = 'badge badge-success';
                    } else {
                        offerSystemStatusSpan.textContent = 'Désactivé';
                        offerSystemStatusSpan.className = 'badge badge-danger';
                    }
                } else {
                    console.warn("[loadMerchantDashboardData] Un ou plusieurs éléments DOM pour les offres sont manquants.");
                }

                if (pointsToAddInput && defaultPointsPerScanInput) { 
                    pointsToAddInput.value = defaultPointsPerScanInput.value;
                }

                // Charger les statistiques
                const statsData = await apiCall('/merchants/stats', 'GET', null, token); 
                if (activeClientsCountSpan) activeClientsCountSpan.textContent = statsData.active_clients_count || '0';
                if (totalVisitsCountSpan) totalVisitsCountSpan.textContent = statsData.total_transactions_count || '0';

            } catch (error) {
                if (!error.message.startsWith("AuthError:")) {
                    showToast('error', `Erreur de chargement des données du tableau de bord: ${error.message}`);
                    console.error('[DEBUG MerchantDashboard] Erreur non liée à l\'auth lors du chargement des données:', error);
                }
            }
        }

        async function handleUpdateMerchantProfileInternal(event) {
            event.preventDefault();
            const token = getToken();
            if (!token) { logout(); return; }

            try {
                const body = {
                    name: merchantProfileNameInput.value,
                    logo_url: merchantLogoInput.value,
                    loyalty_program_type: loyaltyTypeSelect.value,
                    default_points_per_scan: parseInt(defaultPointsPerScanInput.value) || 1
                };
                await apiCall('/merchants/profile', 'PUT', body, token);
                showToast('success', "Profil mis à jour avec succès !");
                loadMerchantDashboardData();
            } catch (error) {
                showToast('error', error.message || "Erreur lors de la mise à jour du profil.");
            }
        }

        async function handleUpdateMerchantOffersInternal(event) {
            event.preventDefault();
            const token = getToken();
            if (!token) { logout(); return; }

            try {
                const body = {
                    offer_is_active: offerIsActiveCheckbox.checked,
                    offer_trigger_points: parseInt(offerTriggerPointsInput.value) || 0,
                    offer_description: offerDescriptionInput.value
                };
                await apiCall('/merchants/offers', 'PUT', body, token);
                showToast('success', "Offres mises à jour avec succès !");
                loadMerchantDashboardData();
            } catch (error) {
                showToast('error', error.message || "Erreur lors de la mise à jour des offres.");
            }
        }

        async function handleAddPointsToCardInternal() {
            const token = getToken();
            if (!token) { logout(); return; }

            // S'assurer que les éléments DOM sont accessibles
            if (!clientCardIdentifierInput || !pointsToAddInput || !stampsToAddInput || !defaultPointsPerScanInput) {
                console.error("Éléments DOM manquants dans handleAddPointsToCardInternal");
                showToast('error', "Erreur interne: Impossible d'ajouter des points.");
                return;
            }

            const card_identifier = clientCardIdentifierInput.value;
            let points_added_val = pointsToAddInput.value; // Renommer pour éviter conflit avec la variable globale
            const stamps_added_val = stampsToAddInput.value; // Renommer

            if (!card_identifier) {
                showToast('warning', "Veuillez entrer l'identifiant de la carte client.");
                return;
            }
            // Vérifier si points_added_val ou stamps_added_val sont vides ou 0
            if ((points_added_val === "" || parseInt(points_added_val) === 0) && (stamps_added_val === "" || parseInt(stamps_added_val) === 0)) {
                const defaultPoints = defaultPointsPerScanInput.value;
                if (defaultPoints !== "" && parseInt(defaultPoints) > 0) {
                    points_added_val = defaultPoints;
                    pointsToAddInput.value = defaultPoints; 
                } else {
                    showToast('warning', "Veuillez spécifier le nombre de points ou de tampons à ajouter, ou configurer des points par défaut.");
                    return;
                }
            }

            try {
                const body = {
                    card_identifier,
                    points_added: parseInt(points_added_val) || 0,
                    stamps_added: parseInt(stamps_added_val) || 0
                };
                const scanResult = await apiCall('/merchants/scan', 'POST', body, token);
                
                let message = `Points/tampons ajoutés. Nouveaux points: ${scanResult.updatedCard.points}, Nouveaux tampons: ${scanResult.updatedCard.stamps}`;
                if (scanResult.new_offer_just_unlocked) {
                    message += " Une nouvelle offre a été débloquée pour ce client !";
                }
                showToast('success', message);
                
                clientCardIdentifierInput.value = '';
                pointsToAddInput.value = defaultPointsPerScanInput.value; 
                stampsToAddInput.value = '0';
                
                if (scanResult.available_offer_to_claim) {
                    const offer = scanResult.available_offer_to_claim;
                    Swal.fire({
                        title: 'Offre disponible !',
                        html: `Le client a une offre disponible : <br><b>${offer.description}</b><br><br>Souhaite-t-il l'utiliser maintenant ?`,
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33',
                        confirmButtonText: 'Oui, utiliser l\'offre',
                        cancelButtonText: 'Non, garder pour plus tard'
                    }).then(async (result) => {
                        if (result.isConfirmed) {
                            try {
                                const claimBody = {
                                    user_card_offer_id: offer.user_card_offer_id,
                                    loyalty_card_id: offer.loyalty_card_id
                                };
                                const claimResult = await apiCall('/merchants/offers/claim', 'POST', claimBody, token);
                                showToast('success', `Offre "${offer.description}" réclamée ! Nouveaux points client : ${claimResult.updated_card_points}`);
                                loadMerchantDashboardData(); 
                            } catch (claimError) {
                                showToast('error', `Erreur lors de la réclamation de l'offre : ${claimError.message}`);
                            }
                        } else {
                            showToast('info', "L'offre n'a pas été utilisée.");
                            loadMerchantDashboardData(); // Recharger même si l'offre n'est pas utilisée pour mettre à jour les stats
                        }
                    });
                } else {
                    loadMerchantDashboardData();
                }

            } catch (error) {
                showToast('error', error.message || "Erreur lors de l'ajout des points/tampons.");
            }
        }

        async function handleClientSearch() {
            // S'assurer que clientSearchInputEl et clientSearchResultsEl sont accessibles
            if (!clientSearchInputEl || !clientSearchResultsEl) {
                console.error("Éléments DOM pour la recherche client manquants dans handleClientSearch");
                return;
            }

            const searchTerm = clientSearchInputEl.value.trim();
            if (searchTerm.length < 2 && !clientSearchInputEl.dataset.scannedValue) { 
                clientSearchResultsEl.innerHTML = '<p class="text-muted p-2">Veuillez entrer au moins 2 caractères.</p>';
                return;
            }

            const effectiveSearchTerm = clientSearchInputEl.dataset.scannedValue || searchTerm;
            clientSearchInputEl.dataset.scannedValue = ''; 

            try {
                const token = getToken();
                // Assurer que le paramètre est bien 'searchTerm'
                const results = await apiCall(`/merchants/clients/search?searchTerm=${encodeURIComponent(effectiveSearchTerm)}`, 'GET', null, token);
                clientSearchResultsEl.innerHTML = ''; 
                if (results.length === 0) {
                    clientSearchResultsEl.innerHTML = '<p class="text-muted p-2">Aucun client trouvé.</p>';
                } else {
                    results.forEach(client => {
                        const item = document.createElement('a');
                        item.href = '#';
                        item.className = 'list-group-item list-group-item-action';
                        item.textContent = `${client.user_name} (${client.user_email || 'Email non fourni'}) - Carte: ${client.card_identifier}`;
                        item.dataset.loyaltyCardId = client.loyalty_card_id;
                        // Stocker toutes les données nécessaires pour displayClientDetails
                        item.dataset.clientData = JSON.stringify(client); 
                        
                        item.addEventListener('click', (e) => {
                            e.preventDefault();
                            // Passer l'objet client complet à displayClientDetails
                            displayClientDetails(JSON.parse(e.currentTarget.dataset.clientData));
                        });
                        clientSearchResultsEl.appendChild(item);
                    });
                }
            } catch (error) {
                showToast('error', `Erreur de recherche client: ${error.message}`);
                clientSearchResultsEl.innerHTML = '<p class="text-danger p-2">Erreur lors de la recherche.</p>';
                console.error("Erreur lors de la recherche de clients:", error);
            }
        }

        function displayClientDetails(clientData) {
            // S'assurer que les éléments DOM sont accessibles
            if (!clientDetailNameEl || !clientDetailEmailEl || !clientDetailCardIdentifierEl || !clientDetailPointsInputEl || !clientDetailQrCodeEl || !selectedClientDetailsEl || !noClientSelectedEl) {
                console.error("Éléments DOM pour les détails client manquants dans displayClientDetails");
                return;
            }
            selectedLoyaltyCardId = clientData.loyalty_card_id; 
            
            clientDetailNameEl.textContent = clientData.user_name;
            clientDetailEmailEl.textContent = clientData.user_email || 'Non fourni';
            clientDetailCardIdentifierEl.textContent = clientData.card_identifier;
            clientDetailPointsInputEl.value = clientData.points;

            clientDetailQrCodeEl.innerHTML = ''; 
            if (typeof QRCode !== 'undefined' && clientData.card_identifier) { // Vérifier que card_identifier existe
                new QRCode(clientDetailQrCodeEl, {
                    text: clientData.card_identifier,
                    width: 140,
                    height: 140,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            } else if (!clientData.card_identifier) {
                clientDetailQrCodeEl.textContent = 'ID Carte manquant.';
            }


            loadClientOffers(clientData.loyalty_card_id);


            selectedClientDetailsEl.style.display = 'block';
            noClientSelectedEl.style.display = 'none';
        }

        async function loadClientOffers(loyaltyCardId) {
            // S'assurer que les éléments DOM sont accessibles
            if (!clientDetailOffersListEl || !noClientOffersEl) {
                console.error("Éléments DOM pour les offres client manquants dans loadClientOffers");
                return;
            }
            clientDetailOffersListEl.innerHTML = ''; // Vider
            noClientOffersEl.style.display = 'none'; // Cacher par défaut

            try {
                const token = getToken();
                // Utiliser la nouvelle route backend pour les commerçants
                const offers = await apiCall(`/merchants/clients/cards/${loyaltyCardId}/offers`, 'GET', null, token); 

                if (offers && offers.length > 0) {
                    let activeOffersFound = false;
                    offers.forEach(offer => {
                        // Afficher toutes les offres, ou seulement les actives non réclamées ?
                        // Pour l'instant, on affiche celles qui sont actives et non réclamées.
                        if(offer.is_active && !offer.claimed_at) { 
                            const li = document.createElement('li');
                            li.className = 'd-flex justify-content-between align-items-center mb-1 p-2 border rounded';
                            
                            const offerText = document.createElement('span');
                            offerText.textContent = `${offer.offer_description_at_unlock} (débloquée à ${offer.points_at_unlock} pts)`;
                            li.appendChild(offerText);
                            
                            // Optionnel: Bouton pour retirer/réclamer l'offre manuellement par le marchand
                            // const claimBtn = document.createElement('button');
                            // claimBtn.className = 'btn btn-sm btn-success ml-2';
                            // claimBtn.textContent = 'Utiliser';
                            // claimBtn.onclick = () => handleClaimClientOfferManually(offer.id, loyaltyCardId);
                            // li.appendChild(claimBtn);

                            clientDetailOffersListEl.appendChild(li);
                            activeOffersFound = true;
                        }
                    });
                    if(!activeOffersFound) {
                         noClientOffersEl.style.display = 'block';
                    }
                } else {
                    noClientOffersEl.style.display = 'block';
                }
            } catch (error) {
                console.warn(`Erreur lors du chargement des offres du client (carte ID: ${loyaltyCardId}):`, error.message);
                // Ne pas afficher "Erreur de chargement des offres" si c'est une 404 (pas d'offres)
                // L'erreur est déjà loggée par apiCall si c'est une erreur serveur.
                // Si l'erreur n'est pas une AuthError, on peut supposer que c'est une 404 ou autre.
                if (!error.message.startsWith("AuthError:")) {
                     clientDetailOffersListEl.innerHTML = ''; // Vider en cas d'erreur pour ne pas laisser d'anciens messages
                     noClientOffersEl.style.display = 'block'; // Afficher "Aucune offre"
                }
            }
        }

        async function handleUpdateClientPoints() {
        // Initialisation et écouteurs d'événements pour merchant_dashboard.html
        const currentToken = getToken();
        const currentUserType = getUserType();
        console.log('[DEBUG MerchantDashboard Init] Token:', currentToken, 'Type:', currentUserType);

        if (currentToken && currentUserType === 'merchant') {
            console.log('[DEBUG MerchantDashboard Init] Token et type OK. Chargement des données...');
            loadMerchantDashboardData();
        } else {
            console.warn('[DEBUG MerchantDashboard Init] Token ou type incorrect. Redirection vers login.');
            logout('merchant'); // S'assurer que la déconnexion est appelée si on arrive ici sans token/type correct
        }

        const addPointsBtn = document.getElementById('addPointsButton');
        if (addPointsBtn) {
            addPointsBtn.addEventListener('click', handleAddPointsToCardInternal);
        }

        const merchantProfileFormEl = document.getElementById('merchantProfileForm');
        if (merchantProfileFormEl) {
            merchantProfileFormEl.addEventListener('submit', handleUpdateMerchantProfileInternal);
        }

        if (offerIsActiveCheckbox && offerConfigurationDetailsDiv) {
            offerIsActiveCheckbox.addEventListener('change', function() {
                offerConfigurationDetailsDiv.style.display = this.checked ? 'block' : 'none';
            });
        }

        if (merchantOfferForm) {
            merchantOfferForm.addEventListener('submit', handleUpdateMerchantOffersInternal);
        }

        // Écouteurs pour la section Clients
        if (clientSearchInputEl) {
            clientSearchInputEl.addEventListener('input', debounce(handleClientSearch, 500));
        }
        if (updateClientPointsButtonEl) {
            updateClientPointsButtonEl.addEventListener('click', handleUpdateClientPoints);
        }
        if(scanClientCardForSearchButtonEl && qrReaderElement) { 
            scanClientCardForSearchButtonEl.addEventListener('click', () => {
                if (!html5QrCodeInstance) {
                    if (typeof Html5Qrcode === 'undefined') {
                        showToast('error', 'La bibliothèque de scan QR n\'est pas chargée.'); return;
                    }
                    html5QrCodeInstance = new Html5Qrcode("qr-reader", false);
                }

                if (qrReaderElement.style.display === 'none' || qrReaderElement.style.display === '') {
                    qrReaderElement.style.display = 'block'; // Afficher le lecteur QR
                    showToast('info', 'Scannez la carte client. Le lecteur QR est sous le bouton de scan principal.'); 
                    if(initiateScanButton) initiateScanButton.disabled = true;

                    const successCallback = (decodedText, decodedResult) => {
                        clientSearchInputEl.value = decodedText;
                        clientSearchInputEl.dataset.scannedValue = decodedText; // Stocker pour la recherche
                        handleClientSearch(); // Lancer la recherche
                        
                        if (html5QrCodeInstance && html5QrCodeInstance.isScanning) {
                            html5QrCodeInstance.stop().then(() => {
                                qrReaderElement.style.display = 'none';
                                if(initiateScanButton) initiateScanButton.disabled = false;
                            }).catch(err => {
                                console.error("Erreur arrêt scan recherche client:", err);
                                qrReaderElement.style.display = 'none';
                                if(initiateScanButton) initiateScanButton.disabled = false;
                            });
                        } else {
                             qrReaderElement.style.display = 'none';
                             if(initiateScanButton) initiateScanButton.disabled = false;
                        }
                    };
                    const errorCallback = (errorMessage) => {};

                    html5QrCodeInstance.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, successCallback, errorCallback)
                    .catch(err => {
                        showToast('error', `Erreur caméra: ${err.message}`);
                        qrReaderElement.style.display = 'none';
                        if(initiateScanButton) initiateScanButton.disabled = false;
                    });
                }
            });
        }

        // Sidebar toggle et navigation de section
        if (menuToggle) {
            menuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                const wrapper = document.getElementById('wrapper');
                if (wrapper) {
                    wrapper.classList.toggle('toggled');
                }
            });
        }

        if (sidebarLinks.length > 0 && contentSections.length > 0) {
            // Afficher la section par défaut (par exemple, 'scan-section')
            const defaultSectionId = 'scan-section'; // ou lire depuis l'URL hash si vous l'utilisez
            contentSections.forEach(section => {
                section.style.display = section.id === defaultSectionId ? 'block' : 'none';
            });
            sidebarLinks.forEach(link => {
                if (link.getAttribute('href') === `#${defaultSectionId.replace('-section', '')}`) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });

            sidebarLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const sectionIdToShow = link.dataset.section;

                    contentSections.forEach(section => {
                        section.style.display = section.id === sectionIdToShow ? 'block' : 'none';
                    });

                    sidebarLinks.forEach(navLink => {
                        navLink.classList.remove('active');
                    });
                    link.classList.add('active');

                    // Si la section de scan est affichée, s'assurer que le lecteur QR est caché par défaut
                    if (sectionIdToShow === 'scan-section' && qrReaderElement) {
                        // qrReaderElement.style.display = 'none'; // Peut-être pas nécessaire si stopProScanner le fait
                        // initiateScanButton.innerHTML = '<i class="bi bi-camera-fill"></i> Scanner via caméra';
                        // On pourrait appeler stopProScanner() ici si on veut un reset complet du scanner en changeant de section
                    }
                });
            });
        } else {
            console.warn("Sidebar links ou content sections non trouvés. La navigation de section ne fonctionnera pas.");
        }
    }

    // --- Fonctions communes (placeholders -> maintenant avec appels API) ---

    // Pour dashboard.html
    async function loadUserLoyaltyCards() {
        console.log("Chargement des cartes de fidélité utilisateur...");
        const token = getToken();
        if (!token) {
            logout('user');
            return;
        }
        try {
            const cardsData = await apiCall('/users/cards', 'GET', null, token);
            const adaptedCardsData = cardsData.map(card => ({
                ...card,
                merchantName: card.merchant_name,
                logoUrl: card.logo_url || 'assets/logo_placeholder.png'
            }));
            displayLoyaltyCards(adaptedCardsData);
        } catch (error) {
            console.error("Erreur lors du chargement des cartes utilisateur:", error);
            if (error.message.includes("401") || error.message.includes("403")) {
                logout('user');
            }
        }
    }

    function displayLoyaltyCards(cards) {
        const listElement = document.getElementById('loyaltyCardsList');
        if (!listElement) return;
        listElement.innerHTML = ''; // Vider la liste actuelle

        function getBackgroundColorForMerchant(merchantId, merchantName) {
            const colors = [
                'linear-gradient(to right bottom, #fd696b, #fa616e, #f65871, #f15075, #ec4879)',
                'linear-gradient(to right bottom, #69c0fd, #61a8fa, #588ff6, #5875f1, #5a5aec)',
                'linear-gradient(to right bottom, #69fd93, #61fa9e, #58f6a8, #58f1b1, #5aecba)',
                'linear-gradient(to right bottom, #fdda69, #fad061, #f9c558, #f9ba58, #f9ae5a)',
                'linear-gradient(to right bottom, #b169fd, #a261fa, #9358f6, #8358f1, #725aec)'
            ];
            let hash = 0;
            for (let i = 0; i < merchantName.length; i++) {
                hash = merchantName.charCodeAt(i) + ((hash << 5) - hash);
            }
            const index = Math.abs(hash % colors.length);
            return colors[index];
        }

        cards.forEach(card => {
            const colDiv = document.createElement('div');
            colDiv.className = 'col-12 col-sm-6 col-md-6 col-lg-4 d-flex justify-content-center';

            const cardContainer = document.createElement('div');
            cardContainer.className = 'loyalty-card-container';

            const cardDiv = document.createElement('div');
            cardDiv.className = 'loyalty-card';
            cardDiv.style.backgroundImage = getBackgroundColorForMerchant(card.merchant_id, card.merchantName || card.merchant_name);
            cardDiv.dataset.merchantId = card.merchant_id;

            // Indicateur d'offre utilisant les données de l'API
            const offerIndicator = document.createElement('span');
            offerIndicator.className = 'offer-indicator';
            
            // Utiliser card.has_active_offer de l'API
            if (card.has_active_offer) {
                offerIndicator.classList.add('visible');
            }
            cardDiv.appendChild(offerIndicator); // Ajouter l'indicateur à la carte

            let pointsOrStamps = '';
            if (card.points !== undefined) {
                pointsOrStamps = `Points: ${card.points}`;
            } else if (card.stamps !== undefined) {
                pointsOrStamps = `Tampons: ${card.stamps}`;
            }

            cardDiv.innerHTML = `
                <div class="loyalty-card__header">
                    <div class="loyalty-card__qr-code" id="qrcode-${card.card_identifier}">
                    </div>
                    <img src="${card.logoUrl || card.logo_url || 'assets/logo_placeholder.png'}" alt="Logo ${card.merchantName || card.merchant_name}" class="loyalty-card__logo-merchant">
                </div>
                <div class="loyalty-card__content">
                    <h5 class="loyalty-card__merchant-name">${card.merchantName || card.merchant_name}</h5>
                    <p class="loyalty-card__points">${pointsOrStamps}</p>
                </div>
                <div class="loyalty-card__identifier" id="barcode-${card.card_identifier}">
                </div>
            `;
            
            cardContainer.appendChild(cardDiv);
            colDiv.appendChild(cardContainer); 
            listElement.appendChild(colDiv); 

            colDiv.addEventListener('click', () => {
                showDetailedCardModal(card); 
            });

            const qrCodeContainer = cardDiv.querySelector(`#qrcode-${card.card_identifier}`);
            if (typeof QRCode !== 'undefined' && qrCodeContainer) {
                qrCodeContainer.innerHTML = ''; 
                new QRCode(qrCodeContainer, {
                    text: card.card_identifier,
                    width: 60,
                    height: 60,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                });
            } else if (qrCodeContainer) {
                qrCodeContainer.innerText = "QR";
            }

            const barcodeContainer = cardDiv.querySelector(`#barcode-${card.card_identifier}`);
            if (typeof JsBarcode !== 'undefined' && barcodeContainer) {
                barcodeContainer.innerHTML = '';
                try {
                    JsBarcode(barcodeContainer, card.card_identifier, {
                        format: "CODE128",
                        lineColor: "#fff",
                        background: "transparent",
                        width: 1.5,
                        height: 30,
                        displayValue: true,
                        fontOptions: "bold",
                        fontColor: "#fff",
                        fontSize: 10,
                        textMargin: 0,
                        margin: 5
                    });
                } catch (e) {
                     barcodeContainer.textContent = card.card_identifier;
                     console.error("Erreur JsBarcode:", e);
                }
            } else if (barcodeContainer) {
                 barcodeContainer.textContent = card.card_identifier;
            }
        });
    }

    async function handleAddCardWrapper() {
        const selectedMerchantId = document.getElementById('merchantSearchResults').dataset.selectedMerchantId;
        if (!selectedMerchantId) {
            showToast('warning', "Veuillez rechercher et sélectionner un commerçant.");
            return;
        }
        try {
            const token = getToken();
            await apiCall('/users/cards', 'POST', { merchant_id: parseInt(selectedMerchantId) }, token);
            showToast('success', "Carte ajoutée avec succès !");
            loadUserLoyaltyCards();
            $('#addCardModal').modal('hide');
            document.getElementById('merchantSearch').value = '';
            document.getElementById('merchantSearchResults').innerHTML = '';
            delete document.getElementById('merchantSearchResults').dataset.selectedMerchantId;
        } catch (error) {
            showToast('error', error.message || "Erreur lors de l'ajout de la carte.");
        }
    }
    
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    async function handleMerchantSearch() {
        const searchTerm = document.getElementById('merchantSearch').value;
        const resultsContainer = document.getElementById('merchantSearchResults');
        if (!resultsContainer) {
            console.error("Le conteneur merchantSearchResults n'existe pas dans le HTML du modal.");
            return;
        }
        resultsContainer.innerHTML = '';
        delete resultsContainer.dataset.selectedMerchantId;

        if (searchTerm.length < 2) {
            return;
        }

        try {
            const merchants = await apiCall(`/merchants/search?name=${encodeURIComponent(searchTerm)}`, 'GET');
            if (merchants.length === 0) {
                resultsContainer.innerHTML = '<p class="text-muted">Aucun commerçant trouvé.</p>';
                return;
            }
            const ul = document.createElement('ul');
            ul.className = 'list-group';
            merchants.forEach(merchant => {
                const li = document.createElement('li');
                li.className = 'list-group-item list-group-item-action';
                li.textContent = merchant.name;
                li.style.cursor = 'pointer';
                li.addEventListener('click', () => {
                    document.getElementById('merchantSearch').value = merchant.name;
                    resultsContainer.dataset.selectedMerchantId = merchant.id;
                    resultsContainer.innerHTML = `<p class="text-success">Commerçant sélectionné : ${merchant.name}</p>`;
                });
                ul.appendChild(li);
            });
            resultsContainer.appendChild(ul);
        } catch (error) {
            resultsContainer.innerHTML = '<p class="text-danger">Erreur lors de la recherche.</p>';
        }
    }

});
