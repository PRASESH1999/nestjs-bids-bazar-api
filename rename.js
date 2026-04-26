const fs = require('fs');

const files = [
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/rules/rule-10-environment-and-development.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/rules/rule-4-database-and-orm-conventions.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/rules/rule-9-logging-and-observability.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/skills/code-review/SKILL.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/skills/nestjs-bidding-api/skills.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/skills/nestjs-bidding-api/references/bootstrap.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/skills/nestjs-bidding-api/references/cls-context.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/skills/nestjs-bidding-api/references/dependencies.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/skills/nestjs-bidding-api/references/environments.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/skills/nestjs-bidding-api/references/error-handelling.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/skills/nestjs-bidding-api/references/logging.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/skills/nestjs-bidding-api/references/project-structure.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/skills/nestjs-bidding-api/references/rabd.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/skills/nestjs-bidding-api/references/seeds.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/skills/nestjs-bidding-api/references/swagger-standards.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/skills/nestjs-bidding-api/references/testing-standards.md",
    "C:/Users/physc/OneDrive/Desktop/RULES/.agents/skills/write-integration-test/SKILL.md"
];

for (const file of files) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        let newContent = content
            .replace(/bidding-api/g, "bids-bazar-api")
            .replace(/Bidding API/g, "Bids Bazzar")
            .replace(/bidding api/gi, "bids bazar api")
            .replace(/bidding_api/g, "bids_bazar_api")
            .replace(/biddingapi/g, "bidsbazarapi")
            .replace(/Bidding Api/g, "Bids Bazzar")
            .replace(/BiddingApi/g, "BidsBazarApi");
        
        if (content !== newContent) {
            fs.writeFileSync(file, newContent, 'utf8');
            console.log("Updated: " + file);
        }
    } else {
        console.log("File not found: " + file);
    }
}
console.log("Renaming process complete.");
