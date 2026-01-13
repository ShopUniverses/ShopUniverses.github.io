/* 
    PROJECT.JS — Vista individual de proyecto
    Autor: Juan David Parra Cantor
    Descripción:
        Carga un proyecto específico desde projects.json
        usando el parámetro id de la URL.
*/

document.addEventListener("DOMContentLoaded", function () {

    /* Obtener el id del proyecto desde la URL */
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("id");

    if (!projectId) {
        mostrarError("Proyecto no especificado.");
        return;
    }

    /* Cargar el JSON de proyectos */
    fetch("../data/projects.json")
        .then(response => response.json())
        .then(projects => {

            const project = projects.find(p => p.id === projectId);

            if (!project) {
                mostrarError("Proyecto no encontrado.");
                return;
            }

            renderizarProyecto(project);

        })
        .catch(error => {
            console.error(error);
            mostrarError("Error al cargar el proyecto.");
        });

    /* -----------------------------------------
        Funciones auxiliares
       ----------------------------------------- */

    function renderizarProyecto(project) {

        /* Título y descripciones */
        document.getElementById("projectTitle").textContent = project.title;
        document.getElementById("projectShortDescription").textContent =
            project.shortDescription;
        document.getElementById("projectDescription").textContent =
            project.description;

        /* Galería */
        const gallerySection = document.getElementById("projectGallerySection");
        const galleryContainer = document.getElementById("projectGallery");

        if (project.gallery && project.gallery.length > 0) {
            galleryContainer.innerHTML = "";

            project.gallery.forEach(imgSrc => {
                const img = document.createElement("img");
                img.src = imgSrc;
                img.alt = project.title;
                galleryContainer.appendChild(img);
            });
        } else {
            gallerySection.style.display = "none";
        }

        /* Tecnologías */
        const techList = document.getElementById("projectTechnologies");
        techList.innerHTML = "";

        project.technologies.forEach(tech => {
            const li = document.createElement("li");
            li.textContent = tech;
            techList.appendChild(li);
        });

        /* Obtener fechas desde GitHub */
        fetch(project.repository.replace("https://github.com/", "https://api.github.com/repos/"))
            .then(response => response.json())
            .then(repoData => {
                document.getElementById("projectStartDate").textContent =
                    new Date(repoData.created_at).toLocaleDateString();

                document.getElementById("projectLastUpdate").textContent =
                    new Date(repoData.updated_at).toLocaleDateString();
            })
            .catch(() => {
                document.getElementById("projectStartDate").textContent = "No disponible";
                document.getElementById("projectLastUpdate").textContent = "No disponible";
            });

        /* Repositorio */
        const repoLink = document.getElementById("projectRepository");
        repoLink.href = project.repository;

        /* Descargas */
        const downloadsContainer = document.getElementById("projectDownloads");
        const downloadsSection = document.getElementById("projectDownloadsSection");

        if (project.downloads && project.downloads.length > 0) {
            downloadsContainer.innerHTML = "";

            project.downloads.forEach(item => {
                const div = document.createElement("div");
                div.classList.add("download-item");

                div.innerHTML = `
                    <strong>${item.version}</strong> — ${item.platform}<br>
                    <a href="${item.url}" target="_blank">
                        Descargar (${item.type})
                    </a>
                `;

                downloadsContainer.appendChild(div);
            });

        } else {
            downloadsSection.style.display = "none";
        }
    }

    function mostrarError(mensaje) {
        document.getElementById("projectTitle").textContent = "Error";
        document.getElementById("projectShortDescription").textContent = mensaje;
    }
});
