# Contributing to DeepResearch

Thank you for considering contributing to DeepResearch! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/DeepResearch.git`
3. Add the upstream repository: `git remote add upstream https://github.com/original-owner/DeepResearch.git`
4. Create a branch for your work: `git checkout -b feature/your-feature-name`

## Development Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Create a `.env` file with required API keys (see README.md)

3. Run the project:
   ```bash
   bun run start "test topic"
   ```

## Making Changes

1. Make your changes in your feature branch
2. Write or update tests as necessary
3. Ensure all tests pass
4. Keep your commits small and focused on a single change
5. Write clear, descriptive commit messages
6. Follow existing code style and patterns

## Pull Requests

1. Update your fork to include the latest changes from the upstream repository
2. Push your changes to your fork: `git push origin feature/your-feature-name`
3. Create a pull request from your branch to the main repository
4. In your pull request description, clearly explain:
   - What problem you're solving
   - How your changes address the problem
   - Any related issues or pull requests

## Code Style

- Follow TypeScript best practices
- Use consistent indentation (2 spaces)
- Add comments for complex sections of code
- Write meaningful variable and function names

## Testing

- Write tests for new features or bug fixes
- Ensure all existing tests pass before submitting

## Feature Requests and Bug Reports

Use the issue templates provided in the repository to submit feature requests or bug reports.

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [MIT License](LICENSE). 