/* 
    PROJECTS.JS — Listado de proyectos
    Autor: Juan David Parra Cantor
    Descripción:
        Carga los proyectos desde projects.json
        y los muestra como tarjetas en projects.html
*/

document.addEventListener("DOMContentLoaded", function () {

    const projectsGrid = document.getElementById("projectsGrid");

    fetch("data/projects.json")
        .then(response => response.json())
        .then(projects => {

            projects.forEach(project => {

                const card = document.createElement("div");
                card.classList.add("project-card");

                card.innerHTML = `
                    <h3>${project.title}</h3>
                    <p>${project.shortDescription}</p>

                    <p><strong>Estado:</strong> ${project.status}</p>

                    <a href="projects/project.html?id=${project.id}" class="card-btn">
                        Ver proyecto →
                    </a>
                `;


                projectsGrid.appendChild(card);
            });

        })
        .catch(error => {
            projectsGrid.innerHTML =
                "<p>Error al cargar los proyectos.</p>";
            console.error(error);
        });
});
